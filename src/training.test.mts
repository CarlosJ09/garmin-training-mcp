import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { compare, demoRows, week } from './training.mts';
import { fetchRecordings } from './garmin.mts';

const end = '2026-11-25';
test('weekly totals include training from the inclusive seven-day window', () => {
  const result = week(demoRows(end), '2026-11-19', end);
  assert.equal(result.runs, 2);
  assert.equal(result.strengthSessions, 1);
  assert.equal(result.recordedRunKm, 10);
});

test('sessions carry the local weekday and run pace so the assistant need not derive them', () => {
  const run = { activityId: 1, activityName: 'Easy', activityType: { typeKey: 'running' },
    startTimeLocal: '2026-11-20 17:44:54', duration: 2766, distance: 6010 };
  const [s] = week([run], '2026-11-19', end).sessions;
  assert.equal(s.weekday, 'Friday');
  assert.equal(s.secondsPerKm, 460);  // 7:40 per km
});

test('unidentified gym workouts do not become evidence for a no-lifting baseline', () => {
  const records = demoRows(end);
  records[0].activityName = 'Strength';
  const result = compare(records, '2026-11-01', end, 'Park 5K', 'leg');
  assert.equal(result.uncertainRuns, 1);
  assert.equal(result.afterLifting.runs, 2);
  assert.equal(result.withoutRecentLifting.runs, 3);
  assert.equal(result.evidence.length, 6);
});

test('a fake Garmin transport exercises token exchange, pagination and deduplication', async t => {
  const old = process.env.GARMIN_PERSONAL_API_KEY;
  process.env.GARMIN_PERSONAL_API_KEY = 'fixture';
  t.after(() => {
    if (old === undefined) delete process.env.GARMIN_PERSONAL_API_KEY;
    else process.env.GARMIN_PERSONAL_API_KEY = old;
  });
  const sample = demoRows(end)[0];
  const calls: string[] = [];
  t.mock.method(globalThis, 'fetch', async (input: URL | string, options: RequestInit) => {
    const url = new URL(input);
    calls.push(url.pathname);
    if (options.method === 'POST') return new Response('sample-bearer-token');
    assert.equal((options.headers as Record<string,string>).Authorization, 'Bearer sample-bearer-token');
    assert.equal(url.searchParams.get('startDate'), '2026-11-19');
    const ids = url.searchParams.get('start') === '0' ? Array.from({ length: 50 }, (_,i) => i) : [49,50];
    return Response.json(ids.map(activityId => ({ ...sample, activityId })));
  });
  assert.equal((await fetchRecordings('2026-11-19', end)).length, 51);
  assert.equal(calls.length, 3);
});

test('a JSON token envelope is unwrapped before use', async t => {
  const old = process.env.GARMIN_PERSONAL_API_KEY;
  process.env.GARMIN_PERSONAL_API_KEY = 'fixture';
  t.after(() => {
    if (old === undefined) delete process.env.GARMIN_PERSONAL_API_KEY;
    else process.env.GARMIN_PERSONAL_API_KEY = old;
  });
  // A query string loads a separate module instance, so no token is cached from the previous test.
  const fresh: typeof import('./garmin.mts') = await import(new URL('./garmin.mts?json-token', import.meta.url).href);
  t.mock.method(globalThis, 'fetch', async (_input: URL | string, options: RequestInit) => {
    if (options.method === 'POST') return Response.json({ access_token: 'jwt-in-json' });
    assert.equal((options.headers as Record<string,string>).Authorization, 'Bearer jwt-in-json');
    return Response.json([]);
  });
  assert.deepEqual(await fresh.fetchRecordings('2026-11-19', end), []);
});

test('stdio client negotiates MCP, discovers tools, runs both and receives validation errors', () => {
  const messages = [
    { id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } },
    { method: 'notifications/initialized' }, { id: 2, method: 'tools/list' },
    { id: 3, method: 'tools/call', params: { name: 'get_training_week' } },
    { id: 4, method: 'tools/call', params: { name: 'compare_runs_after_strength', arguments: { run_title: 'Park 5K' } } },
    { id: 5, method: 'tools/call', params: { name: 'get_training_week', arguments: { end_date: '2026-02-31' } } }
  ];
  const child = spawnSync(process.execPath, [fileURLToPath(new URL('./server.mts', import.meta.url)), '--demo'], {
    input: messages.map(m => JSON.stringify({ jsonrpc: '2.0', ...m })).join('\n') + '\n', encoding: 'utf8', timeout: 10000
  });
  assert.equal(child.status, 0, child.stderr);
  const results = child.stdout.trim().split('\n').map(line => JSON.parse(line).result);
  assert.equal(results[0].protocolVersion, '2025-06-18');
  assert.equal(results[1].tools.length, 2);
  assert.equal(JSON.parse(results[2].content[0].text).source, 'fictional demo');
  assert.equal(JSON.parse(results[3].content[0].text).afterLifting.runs, 3);
  assert.equal(results[4].isError, true);
});
