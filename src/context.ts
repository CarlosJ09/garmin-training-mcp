import type { AppConfig } from './config.ts';
import { demoActivities } from './demo/demo-activities.ts';
import { searchActivities } from './garmin/activities.ts';
import { GarminClient } from './garmin/client.ts';
import { readApiKey } from './garmin/credentials.ts';
import type { GarminActivity } from './garmin/types.ts';
import { isWithin, todayIn, type DateRange, type IsoDate } from './training/dates.ts';

/** Where workouts come from. Garmin in normal use, fictional data with --demo, fakes in tests. */
export interface ActivitySource {
  /** Shown to the assistant so it can say where the numbers came from. */
  readonly label: string;
  listActivities(range: DateRange): Promise<GarminActivity[]>;
}

/** Everything the training queries depend on, so they can run against real or fake data. */
export interface TrainingContext {
  source: ActivitySource;
  today: () => IsoDate;
}

export function createTrainingContext(config: AppConfig): TrainingContext {
  const today = () => todayIn(config.timeZone);
  return { source: config.demo ? demoSource(today) : garminSource(config), today };
}

function garminSource(config: AppConfig): ActivitySource {
  const client = new GarminClient({ baseUrl: config.garmin.baseUrl, getApiKey: () => readApiKey(config.garmin) });
  return {
    label: 'Garmin Connect',
    listActivities: (range) => searchActivities(client, range.start, range.end),
  };
}

function demoSource(today: () => IsoDate): ActivitySource {
  return {
    label: 'fictional demo',
    listActivities: async (range) => demoActivities(today()).filter((activity) => isWithin(activity.startTimeLocal.slice(0, 10), range)),
  };
}
