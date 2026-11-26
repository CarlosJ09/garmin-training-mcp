import type { TrainingContext } from './context.ts';
import { addDays, weekEndingOn, type IsoDate } from './training/dates.ts';
import { compareRunsAfterStrength, type RunComparison } from './training/compare.ts';
import { toSessions } from './training/sessions.ts';
import { summarizeWeek, type TrainingWeek } from './training/week.ts';

/** A result plus where its data came from. */
export type Sourced<T> = T & { source: string };

export async function getTrainingWeek(context: TrainingContext, endDate?: IsoDate): Promise<Sourced<TrainingWeek>> {
  const range = weekEndingOn(endDate ?? context.today());
  const sessions = toSessions(await context.source.listActivities(range));
  return { source: context.source.label, ...summarizeWeek(sessions, range) };
}

export interface RunComparisonQuery {
  runTitle: string;
  strengthTitleContains?: string | undefined;
  /** How many days back from endDate to look for runs. */
  lookbackDays: number;
  endDate?: IsoDate | undefined;
}

export async function getRunComparison(context: TrainingContext, query: RunComparisonQuery): Promise<Sourced<RunComparison>> {
  const end = query.endDate ?? context.today();
  const range = { start: addDays(end, 1 - query.lookbackDays), end };
  // Fetch two extra days so strength sessions just before the first run are included.
  const fetchRange = { start: addDays(range.start, -2), end };
  const sessions = toSessions(await context.source.listActivities(fetchRange));

  return {
    source: context.source.label,
    ...compareRunsAfterStrength(sessions, {
      range,
      runTitle: query.runTitle,
      strengthTitleContains: query.strengthTitleContains,
    }),
  };
}
