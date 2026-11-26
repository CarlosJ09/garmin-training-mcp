import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { searchActivities } from '../../src/garmin/activities.ts';
import { GarminClient } from '../../src/garmin/client.ts';
import { fakeFetch, runActivity } from '../helpers.ts';

/** A client whose data requests are answered by `pageFor(offset)`. */
function clientServing(pageFor: (offset: number) => unknown) {
  const garmin = fakeFetch((url, init) => {
    if (init.method === 'POST') return new Response('token');
    return Response.json(pageFor(Number(url.searchParams.get('start'))));
  });
  const client = new GarminClient({ baseUrl: 'https://garmin.test', getApiKey: async () => 'key', fetch: garmin.fetch });
  return { client, dataRequests: () => garmin.requests.filter((request) => request.init.method !== 'POST') };
}

const activitiesWithIds = (ids: number[]) => ids.map((activityId) => runActivity('2026-11-20 07:00:00', { activityId }));

describe('searchActivities', () => {
  it('follows pagination and drops duplicates across pages', async () => {
    const { client, dataRequests } = clientServing((offset) =>
      offset === 0 ? activitiesWithIds(Array.from({ length: 50 }, (_, i) => i)) : activitiesWithIds([49, 50]),
    );

    const activities = await searchActivities(client, '2026-11-19', '2026-11-25');

    assert.equal(activities.length, 51);
    assert.deepEqual(
      dataRequests().map((request) => request.url.searchParams.get('start')),
      ['0', '50'],
    );
    assert.equal(dataRequests()[0]!.url.searchParams.get('startDate'), '2026-11-19');
    assert.equal(dataRequests()[0]!.url.searchParams.get('endDate'), '2026-11-25');
  });

  it('stops when a full page adds nothing new, instead of looping forever', async () => {
    const { client } = clientServing(() => activitiesWithIds(Array.from({ length: 50 }, (_, i) => i)));
    await assert.rejects(searchActivities(client, '2026-11-19', '2026-11-25'), /repeated page/);
  });

  it('rejects unexpected response shapes', async () => {
    await assert.rejects(searchActivities(clientServing(() => ({ items: [] })).client, '2026-11-19', '2026-11-25'), /Unexpected/);
    await assert.rejects(searchActivities(clientServing(() => [{ activityId: 1 }]).client, '2026-11-19', '2026-11-25'), /incomplete/);
  });
});
