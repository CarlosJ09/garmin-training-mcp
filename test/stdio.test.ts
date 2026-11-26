import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { it } from 'node:test';

const entryPoint = fileURLToPath(new URL('../src/stdio.ts', import.meta.url));

it('the stdio entry point speaks MCP on stdout and exits when the client disconnects', () => {
  const messages = [
    { id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '0' } } },
    { method: 'notifications/initialized' },
    { id: 2, method: 'tools/call', params: { name: 'get_training_week', arguments: {} } },
  ];
  const child = spawnSync(process.execPath, [entryPoint, '--demo'], {
    input: messages.map((message) => JSON.stringify({ jsonrpc: '2.0', ...message })).join('\n') + '\n',
    encoding: 'utf8',
    timeout: 10_000,
  });

  assert.equal(child.status, 0, child.stderr);
  // Every stdout line must be a protocol message; anything else would corrupt the client's stream.
  const responses = child.stdout.trim().split('\n').map((line) => JSON.parse(line));
  assert.equal(responses[0].result.serverInfo.name, 'personal-training-log');
  assert.equal(JSON.parse(responses[1].result.content[0].text).source, 'fictional demo');
});
