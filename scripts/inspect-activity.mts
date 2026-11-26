// Read-only probe: saves what the Personal API returns for one activity so we can see which
// strength details (exercises, sets, reps, weights) are actually recorded before designing a feature.
// Output contains personal data. Write it outside the repository.
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { garminGet } from '../src/garmin.mts';

const [id, outArg] = process.argv.slice(2);
if (!id || !/^\d+$/.test(id) || !outArg) {
  console.error('Usage: node scripts/inspect-activity.mts <activityId> <outDir>');
  process.exit(2);
}
const out = resolve(outArg, id);
await mkdir(out, { recursive: true, mode: 0o700 });

const probes: [string, string][] = [
  ['details', `/activity-service/activity/${id}`],                  // documented
  ['workouts', `/activity-service/activity/${id}/workouts`],        // documented
  ['exerciseSets', `/activity-service/activity/${id}/exerciseSets`] // not documented for the Personal API; probe only
];
for (const [name, path] of probes) {
  try {
    const text = await (await garminGet(path)).text();
    await writeFile(join(out, name + '.json'), text, { mode: 0o600 });
    console.log(`${name}: ok, ${text.length} bytes`);
  } catch (error) {
    console.log(`${name}: ${(error as Error).message}`);
  }
}
try {
  const response = await garminGet(`/download-service/files/activity/${id}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(join(out, 'original.zip'), bytes, { mode: 0o600 });
  console.log(`original file: ok, ${bytes.length} bytes, ${response.headers.get('content-type')}`);
} catch (error) {
  console.log(`original file: ${(error as Error).message}`);
}
console.log('Saved to ' + out);
