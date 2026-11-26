import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { GarminClient, parseAccessToken } from '../../src/garmin/client.ts';
import { GarminApiError } from '../../src/garmin/errors.ts';
import { authorizationOf, fakeFetch } from '../helpers.ts';

const BASE_URL = 'https://garmin.test';
const HOUR_MS = 60 * 60 * 1000;

/** A fake Garmin that issues tokens token-1, token-2, ... and answers data requests with `dataStatus`. */
function fakeGarmin(dataStatus = 200) {
  let issued = 0;
  return fakeFetch((url, init) => {
    if (init.method === 'POST') return new Response(`token-${++issued}`);
    return dataStatus === 200 ? Response.json({ ok: true }) : new Response('', { status: dataStatus });
  });
}

function clientWith(fetch: typeof globalThis.fetch, options: { now?: () => number } = {}) {
  let keyReads = 0;
  const client = new GarminClient({
    baseUrl: BASE_URL,
    getApiKey: async () => {
      keyReads++;
      return 'personal-key';
    },
    fetch,
    ...options,
  });
  return { client, keyReads: () => keyReads };
}

describe('GarminClient', () => {
  it('exchanges the API key once and reuses the access token', async () => {
    const garmin = fakeGarmin();
    const { client, keyReads } = clientWith(garmin.fetch);

    await client.getJson('/a');
    await client.getJson('/b');

    assert.equal(keyReads(), 1);
    assert.deepEqual(
      garmin.requests.map((request) => authorizationOf(request.init)),
      ['ApiKey personal-key', 'Bearer token-1', 'Bearer token-1'],
    );
  });

  it('does not read the key until a request needs it', () => {
    const { keyReads } = clientWith(fakeGarmin().fetch);
    assert.equal(keyReads(), 0);
  });

  it('renews the token before Garmin expires it', async () => {
    let now = 0;
    const garmin = fakeGarmin();
    const { client } = clientWith(garmin.fetch, { now: () => now });

    await client.getJson('/a');
    now += 23 * HOUR_MS;
    await client.getJson('/b');

    assert.equal(authorizationOf(garmin.requests.at(-1)!.init), 'Bearer token-2');
  });

  it('drops a rejected token so the next request exchanges the key again', async () => {
    let status = 401;
    let issued = 0;
    const garmin = fakeFetch((_url, init) => {
      if (init.method === 'POST') return new Response(`token-${++issued}`);
      return status === 200 ? Response.json({ ok: true }) : new Response('', { status });
    });
    const { client, keyReads } = clientWith(garmin.fetch);

    await assert.rejects(client.getJson('/a'), (error) => error instanceof GarminApiError && error.isAuthError);
    status = 200;
    await client.getJson('/a');

    assert.equal(keyReads(), 2);
    assert.equal(authorizationOf(garmin.requests.at(-1)!.init), 'Bearer token-2');
  });

  it('explains HTTP failures without exposing request details', async () => {
    const { client } = clientWith(fakeGarmin(429).fetch);
    await assert.rejects(client.getJson('/a'), /rate-limiting/);
  });
});

describe('parseAccessToken', () => {
  it('accepts a bare token or a JSON envelope', () => {
    assert.equal(parseAccessToken(' eyJ.payload.sig \n'), 'eyJ.payload.sig');
    assert.equal(parseAccessToken('{"access_token":"eyJ.payload.sig","expires_in":86400}'), 'eyJ.payload.sig');
  });

  it('rejects responses without a token', () => {
    for (const body of ['', '   ', '{}', '{"access_token":42}', '{not json']) {
      assert.throws(() => parseAccessToken(body), /no usable access token/, body);
    }
  });
});
