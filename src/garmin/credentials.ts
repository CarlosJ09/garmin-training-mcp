import { readFile } from 'node:fs/promises';
import type { GarminConfig } from '../config.ts';

/** Return the Personal API key from the environment or the key file. Never log the result. */
export async function readApiKey({ apiKey, apiKeyFile }: Pick<GarminConfig, 'apiKey' | 'apiKeyFile'>): Promise<string> {
  if (apiKey) return apiKey;

  const fromFile = await readFile(apiKeyFile, 'utf8').then(
    (contents) => contents.trim(),
    (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return '';
      throw error;
    },
  );
  if (fromFile) return fromFile;

  throw new Error(
    'No Garmin Personal API key found. Run scripts/save-garmin-key.sh or set GARMIN_PERSONAL_API_KEY. Start with --demo for fictional data.',
  );
}
