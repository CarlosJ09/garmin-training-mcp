import { isWithin, type DateRange, type IsoDate } from './dates.ts';
import { summarizeSession, type Session, type SessionSummary } from './sessions.ts';
import { round2, sum } from './stats.ts';

export interface TrainingWeek {
  startDate: IsoDate;
  endDate: IsoDate;
  runs: number;
  strengthSessions: number;
  /** Total distance of runs that recorded one. */
  recordedRunKm: number;
  /** Total duration of all sessions that recorded one. */
  recordedTrainingMinutes: number;
  sessions: SessionSummary[];
}

export function summarizeWeek(sessions: readonly Session[], range: DateRange): TrainingWeek {
  const inRange = sessions.filter((session) => isWithin(session.localDate, range));
  const runs = inRange.filter((session) => session.sport === 'running');

  return {
    startDate: range.start,
    endDate: range.end,
    runs: runs.length,
    strengthSessions: inRange.filter((session) => session.sport === 'strength').length,
    recordedRunKm: round2(sum(runs.map((run) => run.distanceMeters ?? 0)) / 1000),
    recordedTrainingMinutes: round2(sum(inRange.map((session) => session.durationSeconds ?? 0)) / 60),
    sessions: inRange.map(summarizeSession),
  };
}
