import { createInterface } from 'node:readline';
import { fetchRecordings } from './garmin.mts';
import { compare, demoRows, parseDay, shiftDay, today, week } from './training.mts';

const demo = process.argv.includes('--demo');
const info = { name: 'personal-training-log', version: '0.1.0' };
const versions = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
const dateField = { type: 'string', format: 'date', description: 'Inclusive last local date. Defaults to today.' };
const definitions = [
  { name: 'get_training_week', description: 'Running and strength sessions for seven days ending on end_date. Returns recorded totals and session titles.',
    inputSchema: { type: 'object', properties: { end_date: dateField }, additionalProperties: false } },
  { name: 'compare_runs_after_strength', description: 'Compare runs sharing an exact activity title by whether a strength session started in the prior 24 hours. Optional strength_title matches part of a gym activity title, for example Legs. Unmatched recent gym days are excluded from both groups. Report group sizes and limitations.',
    inputSchema: { type: 'object', properties: { run_title: { type: 'string', minLength: 1 }, strength_title: { type: 'string', minLength: 1 },
      days: { type: 'integer', minimum: 1, maximum: 90 }, end_date: dateField }, required: ['run_title'], additionalProperties: false } }
].map(tool => ({ ...tool, annotations: { readOnlyHint: true } }));

async function call(name: string, args: Record<string, unknown>) {
  const tool = definitions.find(tool => tool.name === name);
  if (!tool) throw new Error('Unknown training tool.');
  if (!args || typeof args !== 'object' || Array.isArray(args) || Object.keys(args).some(k => !Object.hasOwn(tool.inputSchema.properties, k))) throw new Error('Invalid tool arguments.');
  const end = parseDay(args.end_date ?? today());
  const source = demo ? 'fictional demo' : 'Garmin Connect';
  const load = async (start: string) => demo ? demoRows(today()) : await fetchRecordings(start, end);
  if (name === 'get_training_week') {
    const first = shiftDay(end, -6);
    return { source, ...week(await load(first), first, end) };
  }
  const days = args.days ?? 42;
  if (typeof days !== 'number' || !Number.isInteger(days) || days < 1 || days > 90) throw new Error('days must be 1 to 90.');
  if (typeof args.run_title !== 'string' || !args.run_title.trim()) throw new Error('Supply a run_title from your weekly log.');
  if (args.strength_title !== undefined && (typeof args.strength_title !== 'string' || !args.strength_title.trim())) throw new Error('Supply a non-empty strength_title.');
  const first = shiftDay(end, 1 - days);
  return { source, ...compare(await load(shiftDay(first, -2)), first, end, args.run_title.trim(), (args.strength_title as string | undefined)?.trim()) };
}

if (process.argv.includes('--preview')) {
  try { console.log(JSON.stringify(await call('get_training_week', {}), null, 2)); }
  catch (error) { console.error((error as Error).message); process.exitCode = 1; }
} else {
  const reply = (id: unknown, body: object) => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, ...body }) + '\n');
  for await (const line of createInterface({ input: process.stdin, crlfDelay: Infinity })) {
    if (!line.trim()) continue;
    let request;
    try { request = JSON.parse(line); }
    catch { reply(null, { error: { code: -32700, message: 'Invalid JSON' } }); continue; }
    if (request?.jsonrpc !== '2.0' || typeof request.method !== 'string') {
      reply(request?.id ?? null, { error: { code: -32600, message: 'Invalid request' } }); continue;
    }
    const { id, method, params } = request;
    if (id === undefined) continue;
    switch (method) {
      case 'initialize':
        reply(id, { result: { protocolVersion: versions.includes(params?.protocolVersion) ? params.protocolVersion : versions[0],
          capabilities: { tools: {} }, serverInfo: info } }); break;
      case 'ping': reply(id, { result: {} }); break;
      case 'tools/list': reply(id, { result: { tools: definitions } }); break;
      case 'tools/call':
        try {
          const data = await call(params?.name, params?.arguments ?? {});
          reply(id, { result: { content: [{ type: 'text', text: JSON.stringify(data) }] } });
        } catch (error) {
          reply(id, { result: { isError: true, content: [{ type: 'text', text: (error as Error).message }] } });
        }
        break;
      default: reply(id, { error: { code: -32601, message: 'Unknown method' } });
    }
  }
}
