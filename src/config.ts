import { homedir } from 'node:os';
import { join } from 'node:path';

export const DEFAULT_TIME_ZONE = 'America/Santo_Domingo';
const GARMIN_BASE_URL = 'https://personal.connectapi.garmin.com';

export interface GarminConfig {
  baseUrl: string;
  /** Key from GARMIN_PERSONAL_API_KEY, if set. Takes precedence over the key file. */
  apiKey: string | undefined;
  /** The file Garmin's own client reads: ~/.config/garmin/connect-personal-api-key. */
  apiKeyFile: string;
}

export interface AppConfig {
  /** Serve fictional workouts instead of calling Garmin. Enabled only by the --demo flag. */
  demo: boolean;
  /** IANA time zone that decides what "today" is. */
  timeZone: string;
  garmin: GarminConfig;
}

export function loadConfig(argv: readonly string[] = process.argv.slice(2), env: NodeJS.ProcessEnv = process.env): AppConfig {
  const timeZone = env.TRAINING_TIME_ZONE?.trim() || DEFAULT_TIME_ZONE;
  assertValidTimeZone(timeZone);

  return {
    demo: argv.includes('--demo'),
    timeZone,
    garmin: {
      baseUrl: GARMIN_BASE_URL,
      apiKey: env.GARMIN_PERSONAL_API_KEY?.trim() || undefined,
      apiKeyFile: join(homedir(), '.config', 'garmin', 'connect-personal-api-key'),
    },
  };
}

function assertValidTimeZone(timeZone: string): void {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
  } catch {
    throw new Error(`TRAINING_TIME_ZONE "${timeZone}" is not a valid IANA time zone, for example ${DEFAULT_TIME_ZONE}.`);
  }
}
