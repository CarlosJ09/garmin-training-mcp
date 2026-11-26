// Read-only probe: saves what the Personal API returns for one activity, to see which strength
// details (exercises, sets, reps, weights) are actually recorded before designing a feature.
// The output is personal data. Write it outside the repository.
//
// Usage: node scripts/inspect-activity.ts <activityId> <outDir>
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { loadConfig } from '../src/config.ts';
import { GarminClient } from '../src/garmin/client.ts';
import { readApiKey } from '../src/garmin/credentials.ts';

const [activityId, outDir] = process.argv.slice(2);
if (!activityId || !/^\d+$/.test(activityId) || !outDir) {
  console.error('Usage: node scripts/inspect-activity.ts <activityId> <outDir>');
  process.exit(2);
}

const { garmin } = loadConfig();
const client = new GarminClient({ baseUrl: garmin.baseUrl, getApiKey: () => readApiKey(garmin) });
const target = resolve(outDir, activityId);
await mkdir(target, { recursive: true, mode: 0o700 });

const jsonProbes = {
  details: `/activity-service/activity/${activityId}`, // documented
  workouts: `/activity-service/activity/${activityId}/workouts`, // documented
  exerciseSets: `/activity-service/activity/${activityId}/exerciseSets`, // undocumented for the Personal API
};

for (const [name, path] of Object.entries(jsonProbes)) {
  try {
    const body = await (await client.get(path)).text();
    await writeFile(join(target, `${name}.json`), body, { mode: 0o600 });
    console.log(`${name}: ok, ${body.length} bytes`);
  } catch (error) {
    console.log(`${name}: ${error instanceof Error ? error.message : error}`);
  }
}

try {
  const response = await client.get(`/download-service/files/activity/${activityId}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(join(target, 'original.zip'), bytes, { mode: 0o600 });
  console.log(`original file: ok, ${bytes.length} bytes, ${response.headers.get('content-type')}`);
} catch (error) {
  console.log(`original file: ${error instanceof Error ? error.message : error}`);
}

console.log(`Saved to ${target}`);
