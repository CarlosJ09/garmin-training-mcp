import type { TrainingContext } from '../src/context.ts';
import type { GarminActivity } from '../src/garmin/types.ts';
import type { IsoDate } from '../src/training/dates.ts';
import { toSession, type Session } from '../src/training/sessions.ts';

/** Fixture times are local to UTC-4, like America/Santo_Domingo. */
const FIXTURE_UTC_OFFSET = '-04:00';
export const TODAY: IsoDate = '2026-11-25';

let nextActivityId = 1;

export function garminActivity(typeKey: string, startTimeLocal: string, fields: Partial<GarminActivity> = {}): GarminActivity {
  return {
    activityId: nextActivityId++,
    activityType: { typeKey },
    startTimeLocal,
    startTimeGMT: localToGmt(startTimeLocal),
    ...fields,
  };
}

/** A 5 km run at 5:00/km and 150 bpm unless overridden. */
export function runActivity(startTimeLocal: string, fields: Partial<GarminActivity> = {}): GarminActivity {
  return garminActivity('running', startTimeLocal, { activityName: 'Park 5K', duration: 1500, distance: 5000, averageHR: 150, ...fields });
}

export function strengthActivity(startTimeLocal: string, activityName = 'Strength', fields: Partial<GarminActivity> = {}): GarminActivity {
  return garminActivity('strength_training', startTimeLocal, { activityName, duration: 2700, ...fields });
}

export function sessionOf(activity: GarminActivity): Session {
  const session = toSession(activity);
  if (!session) throw new Error(`Fixture sport ${activity.activityType?.typeKey} is not tracked.`);
  return session;
}

export function fixtureContext(activities: GarminActivity[], today: IsoDate = TODAY): TrainingContext {
  return { source: { label: 'test fixture', listActivities: async () => activities }, today: () => today };
}

/** A stand-in for fetch that records each request and answers with `respond`. */
export function fakeFetch(respond: (url: URL, init: RequestInit) => Response | Promise<Response>) {
  const requests: { url: URL; init: RequestInit }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init = {}) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    requests.push({ url, init });
    return respond(url, init);
  };
  return { fetch, requests };
}

export function authorizationOf(init: RequestInit): string | undefined {
  return new Headers(init.headers).get('Authorization') ?? undefined;
}

function localToGmt(startTimeLocal: string): string {
  return new Date(`${startTimeLocal.replace(' ', 'T')}${FIXTURE_UTC_OFFSET}`).toISOString().slice(0, 19).replace('T', ' ');
}
