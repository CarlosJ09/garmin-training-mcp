import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { readApiKey } from '../../src/garmin/credentials.ts';

describe('readApiKey', () => {
  let directory: string;
  let keyFile: string;

  before(async () => {
    directory = await mkdtemp(join(tmpdir(), 'garmin-key-'));
    keyFile = join(directory, 'connect-personal-api-key');
    await writeFile(keyFile, '  key-from-file\n');
  });
  after(() => rm(directory, { recursive: true, force: true }));

  it('prefers the environment variable', async () => {
    assert.equal(await readApiKey({ apiKey: 'key-from-env', apiKeyFile: keyFile }), 'key-from-env');
  });

  it('reads and trims the key file', async () => {
    assert.equal(await readApiKey({ apiKey: undefined, apiKeyFile: keyFile }), 'key-from-file');
  });

  it('explains how to set up a key when none exists', async () => {
    await assert.rejects(readApiKey({ apiKey: undefined, apiKeyFile: join(directory, 'missing') }), /save-garmin-key\.sh/);
  });
});
