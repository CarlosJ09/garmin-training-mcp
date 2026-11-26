import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import packageJson from '../package.json' with { type: 'json' };
import type { TrainingContext } from './context.ts';
import { getRunComparison, getTrainingWeek } from './queries.ts';
import { isIsoDate } from './training/dates.ts';

const DEFAULT_LOOKBACK_DAYS = 42;
const MAX_LOOKBACK_DAYS = 90;

const INSTRUCTIONS = `Answers questions about the user's running and strength sessions recorded on their Garmin watch.
Report numbers as the tools return them; don't recompute dates, weekdays or paces.
Describe differences between groups as observations, not causes. Always state group sizes, and say so when a sample is too small to conclude anything.
When asked which workouts were used, list them by date, title and Garmin activity id.`;

const isoDate = z.string().refine(isIsoDate, 'Use a real calendar date in YYYY-MM-DD format.');

/** Tools only read data; Garmin is an external system, hence openWorldHint. */
const READ_ONLY = { readOnlyHint: true, openWorldHint: true } as const;

/** The MCP server, independent of transport. stdio.ts connects it locally; an HTTP entry point could reuse it. */
export function createTrainingServer(context: TrainingContext): McpServer {
  const server = new McpServer({ name: 'personal-training-log', version: packageJson.version }, { instructions: INSTRUCTIONS });

  server.registerTool(
    'get_training_week',
    {
      title: 'Training week',
      description:
        'Runs and strength sessions for the seven calendar days ending on end_date. Returns totals and every session with its ' +
        'Garmin activity id, weekday, start time, duration, distance, pace and average heart rate.',
      inputSchema: {
        end_date: isoDate.optional().describe('Last day of the week, inclusive (YYYY-MM-DD). Defaults to today.'),
      },
      annotations: READ_ONLY,
    },
    async ({ end_date }) => jsonResult(await getTrainingWeek(context, end_date)),
  );

  server.registerTool(
    'compare_runs_after_strength',
    {
      title: 'Runs after strength training',
      description:
        'Compare runs that share an exact title by whether a strength session started in the 24 hours before. ' +
        'Returns group sizes, median pace and heart rate, and every run used. Runs whose recent strength session ' +
        "doesn't match strength_title are counted as uncertain, not as rested.",
      inputSchema: {
        run_title: z.string().trim().min(1).describe('Exact title of a recurring run, as listed by get_training_week.'),
        strength_title: z
          .string()
          .trim()
          .min(1)
          .optional()
          .describe('Only count strength sessions whose title contains this text, for example "Piernas" for leg day.'),
        days: z
          .number()
          .int()
          .min(1)
          .max(MAX_LOOKBACK_DAYS)
          .default(DEFAULT_LOOKBACK_DAYS)
          .describe('How many days back to look for runs.'),
        end_date: isoDate.optional().describe('Last day to include (YYYY-MM-DD). Defaults to today.'),
      },
      annotations: READ_ONLY,
    },
    async ({ run_title, strength_title, days, end_date }) =>
      jsonResult(
        await getRunComparison(context, {
          runTitle: run_title,
          strengthTitleContains: strength_title,
          lookbackDays: days,
          endDate: end_date,
        }),
      ),
  );

  return server;
}

function jsonResult(data: object): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data) }] };
}
