import type { GarminActivity } from '../garmin/types.ts';
import { weekdayOf, type IsoDate } from './dates.ts';
import { round2 } from './stats.ts';

export type Sport = 'running' | 'strength';

/** A run or strength workout, normalized from Garmin's activity format. Unrecorded metrics are null. */
export interface Session {
  id: string;
  title: string;
  sport: Sport;
  /** Calendar date where the session took place. */
  localDate: IsoDate;
  /** Local wall-clock start as Garmin records it, "YYYY-MM-DD HH:mm:ss". */
  localStart: string;
  /** Start instant in epoch milliseconds, or null when Garmin omits the UTC start. */
  startedAtMs: number | null;
  durationSeconds: number | null;
  distanceMeters: number | null;
  averageHeartRate: number | null;
}

/** What the assistant sees for one session: display units plus values it shouldn't have to derive itself. */
export interface SessionSummary {
  id: string;
  title: string;
  sport: Sport;
  weekday: string;
  localStart: string;
  minutes: number | null;
  km: number | null;
  secondsPerKm: number | null;
  averageBpm: number | null;
}

/** Normalize Garmin activities, dropping sports this project doesn't track. Oldest first. */
export function toSessions(activities: readonly GarminActivity[]): Session[] {
  return activities
    .map(toSession)
    .filter((session) => session !== null)
    .sort((a, b) => a.localStart.localeCompare(b.localStart));
}

export function toSession(activity: GarminActivity): Session | null {
  const sport = sportOf(activity.activityType?.typeKey);
  if (!sport) return null;

  return {
    id: String(activity.activityId),
    title: activity.activityName?.trim() ?? '',
    sport,
    localDate: activity.startTimeLocal.slice(0, 10),
    localStart: activity.startTimeLocal,
    startedAtMs: parseGarminUtc(activity.startTimeGMT),
    durationSeconds: positiveOrNull(activity.duration),
    distanceMeters: sport === 'running' ? positiveOrNull(activity.distance) : null,
    averageHeartRate: positiveOrNull(activity.averageHR),
  };
}

export function paceSecondsPerKm(session: Session): number | null {
  if (session.durationSeconds === null || session.distanceMeters === null) return null;
  return session.durationSeconds / (session.distanceMeters / 1000);
}

export function summarizeSession(session: Session): SessionSummary {
  const pace = paceSecondsPerKm(session);
  return {
    id: session.id,
    title: session.title,
    sport: session.sport,
    weekday: weekdayOf(session.localDate),
    localStart: session.localStart,
    minutes: session.durationSeconds === null ? null : round2(session.durationSeconds / 60),
    km: session.distanceMeters === null ? null : round2(session.distanceMeters / 1000),
    secondsPerKm: pace === null ? null : Math.round(pace),
    averageBpm: session.averageHeartRate,
  };
}

function sportOf(typeKey: string | undefined): Sport | null {
  if (!typeKey) return null;
  // Garmin has running, trail_running, treadmill_running, track_running and others.
  if (typeKey.split('_').includes('running')) return 'running';
  if (typeKey === 'strength_training') return 'strength';
  return null;
}

/** Garmin's startTimeGMT is "YYYY-MM-DD HH:mm:ss" in UTC, usually without a zone suffix. */
function parseGarminUtc(value: string | undefined): number | null {
  if (!value) return null;
  const iso = value.replace(' ', 'T');
  const hasZone = /(Z|[+-]\d\d:\d\d)$/.test(iso);
  const ms = Date.parse(hasZone ? iso : `${iso}Z`);
  return Number.isFinite(ms) ? ms : null;
}

function positiveOrNull(value: number | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}
