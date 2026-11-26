import type { GarminActivity } from '../garmin/types.ts';
import { addDays, type IsoDate } from '../training/dates.ts';

/** Demo sessions happen in UTC-4 (America/Santo_Domingo has no daylight saving time). */
const DEMO_UTC_OFFSET = '-04:00';
const RUN_COUNT = 6;
const DAYS_BETWEEN_RUNS = 4;

interface DemoSession {
  date: IsoDate;
  time: string;
  name: string;
  typeKey: string;
  durationSeconds: number;
  distanceMeters?: number;
  averageHeartRate?: number;
}

/**
 * Fictional, deterministic training history ending on `anchor`: a "Park 5K" every four days at 07:00,
 * with a "Leg day" the evening before every other run. Runs after leg day are 30 seconds slower.
 */
export function demoActivities(anchor: IsoDate): GarminActivity[] {
  const sessions: DemoSession[] = [];

  for (let index = 0; index < RUN_COUNT; index++) {
    const runDate = addDays(anchor, -DAYS_BETWEEN_RUNS * index);
    const afterLegDay = index % 2 === 0;

    if (afterLegDay) {
      sessions.push({ date: addDays(runDate, -1), time: '18:00', name: 'Leg day', typeKey: 'strength_training', durationSeconds: 45 * 60 });
    }
    sessions.push({
      date: runDate,
      time: '07:00',
      name: 'Park 5K',
      typeKey: 'running',
      durationSeconds: 1600 + (afterLegDay ? 30 : 0) + 2 * index,
      distanceMeters: 5000,
      averageHeartRate: 145 + index,
    });
  }

  return sessions.map(toGarminActivity);
}

function toGarminActivity(session: DemoSession, index: number): GarminActivity {
  const startTimeLocal = `${session.date} ${session.time}:00`;
  const startUtc = new Date(`${session.date}T${session.time}:00${DEMO_UTC_OFFSET}`);

  return {
    activityId: `demo-${index}`,
    activityName: session.name,
    activityType: { typeKey: session.typeKey },
    startTimeLocal,
    startTimeGMT: startUtc.toISOString().slice(0, 19).replace('T', ' '),
    duration: session.durationSeconds,
    distance: session.distanceMeters,
    averageHR: session.averageHeartRate,
  };
}
