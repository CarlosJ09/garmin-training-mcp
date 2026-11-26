import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { TrainingContext } from '../src/context.ts';
import { GarminApiError } from '../src/garmin/errors.ts';
import { createTrainingServer } from '../src/server.ts';
import { fixtureContext, runActivity, strengthActivity, TODAY } from './helpers.ts';

/** Connect a real MCP client to the server in memory, so tests exercise the actual protocol. */
async function connect(context: TrainingContext): Promise<Client> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await Promise.all([createTrainingServer(context).connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

async function call(client: Client, name: string, args: Record<string, unknown> = {}) {
  const result = await client.callTool({ name, arguments: args });
  const [first] = result.content as { type: string; text: string }[];
  assert.ok(first && first.type === 'text');
  return { isError: result.isError === true, text: first.text };
}

const week = [runActivity('2026-11-20 07:00:00'), strengthActivity('2026-11-22 18:00:00', 'Piernas'), runActivity('2026-11-23 07:00:00')];

describe('training MCP server', () => {
  it('advertises two read-only tools and guidance for the assistant', async () => {
    const client = await connect(fixtureContext(week));
    const { tools } = await client.listTools();

    assert.deepEqual(tools.map((tool) => tool.name).sort(), ['compare_runs_after_strength', 'get_training_week']);
    assert.ok(tools.every((tool) => tool.annotations?.readOnlyHint === true));
    assert.match(client.getInstructions() ?? '', /group sizes/);
  });

  it('returns the week ending today with its data source', async () => {
    const result = await call(await connect(fixtureContext(week)), 'get_training_week');
    const data = JSON.parse(result.text);

    assert.equal(result.isError, false);
    assert.equal(data.source, 'test fixture');
    assert.equal(data.endDate, TODAY);
    assert.equal(data.runs, 2);
    assert.equal(data.strengthSessions, 1);
  });

  it('compares runs with the default 42-day lookback and the title filter', async () => {
    const result = await call(await connect(fixtureContext(week)), 'compare_runs_after_strength', { run_title: 'Park 5K', strength_title: 'piernas' });
    const data = JSON.parse(result.text);

    assert.equal(data.startDate, '2026-10-15');
    assert.equal(data.afterStrength.runs, 1);
    assert.equal(data.withoutRecentStrength.runs, 1);
  });

  it('rejects invalid arguments as tool errors', async () => {
    const client = await connect(fixtureContext(week));
    assert.equal((await call(client, 'get_training_week', { end_date: '2026-02-31' })).isError, true);
    assert.equal((await call(client, 'compare_runs_after_strength', { run_title: 'Park 5K', days: 91 })).isError, true);
    assert.equal((await call(client, 'compare_runs_after_strength', { run_title: '   ' })).isError, true);
  });

  it('reports a Garmin failure as a clear tool error instead of empty data', async () => {
    const failing: TrainingContext = {
      source: {
        label: 'Garmin Connect',
        listActivities: async () => {
          throw new GarminApiError(401);
        },
      },
      today: () => TODAY,
    };
    const result = await call(await connect(failing), 'get_training_week');

    assert.equal(result.isError, true);
    assert.match(result.text, /rejected the API key/);
  });
});
