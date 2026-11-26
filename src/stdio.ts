// Entry point for local MCP clients (Claude Desktop, Claude Code, Codex): node src/stdio.ts [--demo]
// stdout carries protocol messages only, so diagnostics must go to stderr.
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig } from './config.ts';
import { createTrainingContext } from './context.ts';
import { createTrainingServer } from './server.ts';

try {
  const server = createTrainingServer(createTrainingContext(loadConfig()));
  await server.connect(new StdioServerTransport());
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
