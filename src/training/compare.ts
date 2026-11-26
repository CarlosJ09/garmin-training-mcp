import { DAY_MS, daysBetween, isWithin, type DateRange, type IsoDate } from './dates.ts';
import { paceSecondsPerKm, summarizeSession, type Session, type SessionSummary } from './sessions.ts';
import { isPresent, median, round2 } from './stats.ts';

/** A strength session counts as recent if it started within this long before the run started. */
export const RECENT_STRENGTH_WINDOW_MS = DAY_MS;

const METHOD =
  'Runs share an exact title, which does not verify route, distance or conditions. ' +
  'A strength session counts as recent if it started within the 24 hours before the run started.';

export type RunGroup = 'afterStrength' | 'withoutRecentStrength' | 'uncertain';

export interface RunComparisonOptions {
  range: DateRange;
  /** Only runs with exactly this title (case-insensitive). */
  runTitle: string;
  /** If set, only strength sessions whose title contains this text count, for example "Piernas". */
  strengthTitleContains?: string | undefined;
}

export interface GroupStats {
  runs: number;
  medianSecondsPerKm: number | null;
  runsWithPace: number;
  medianBpm: number | null;
  runsWithHeartRate: number;
}

export interface RunEvidence {
  run: SessionSummary;
  group: RunGroup;
  precedingStrength: SessionSummary[];
}

export interface RunComparison {
  startDate: IsoDate;
  endDate: IsoDate;
  runTitle: string;
  strengthTitleContains: string | null;
  method: string;
  afterStrength: GroupStats;
  withoutRecentStrength: GroupStats;
  uncertainRuns: number;
  /** Every run considered, so the assistant can show which workouts it used. */
  evidence: RunEvidence[];
}

interface Classification {
  group: RunGroup;
  precedingStrength: Session[];
}

export function compareRunsAfterStrength(sessions: readonly Session[], options: RunComparisonOptions): RunComparison {
  const strengthSessions = sessions.filter((session) => session.sport === 'strength');
  const runs = sessions.filter(
    (session) => session.sport === 'running' && isWithin(session.localDate, options.range) && sameText(session.title, options.runTitle),
  );
  const classified = runs.map((run) => ({ run, ...classifyRun(run, strengthSessions, options.strengthTitleContains) }));
  const runsIn = (group: RunGroup) => classified.filter((entry) => entry.group === group).map((entry) => entry.run);

  return {
    startDate: options.range.start,
    endDate: options.range.end,
    runTitle: options.runTitle,
    strengthTitleContains: options.strengthTitleContains ?? null,
    method: METHOD,
    afterStrength: groupStats(runsIn('afterStrength')),
    withoutRecentStrength: groupStats(runsIn('withoutRecentStrength')),
    uncertainRuns: runsIn('uncertain').length,
    evidence: classified.map((entry) => ({
      run: summarizeSession(entry.run),
      group: entry.group,
      precedingStrength: entry.precedingStrength.map(summarizeSession),
    })),
  };
}

/**
 * - afterStrength: a strength session matching the title filter started in the 24 hours before the run.
 * - uncertain: recent strength can't be ruled in or out, because a start time is missing
 *   or the recent session's title doesn't say whether it matches (for example a generic "Strength").
 * - withoutRecentStrength: no strength session in that window.
 */
export function classifyRun(run: Session, strengthSessions: readonly Session[], strengthTitleContains?: string): Classification {
  const runStart = run.startedAtMs;
  if (runStart === null) return { group: 'uncertain', precedingStrength: [] };

  const precedingStrength = strengthSessions.filter((strength) => {
    if (strength.startedAtMs === null) return false;
    const gap = runStart - strength.startedAtMs;
    return gap > 0 && gap <= RECENT_STRENGTH_WINDOW_MS;
  });
  // A session on the run's day or the day before, without a UTC start, might fall inside the window.
  const hasUntimedStrengthNearby = strengthSessions.some((strength) => {
    if (strength.startedAtMs !== null) return false;
    const daysBefore = daysBetween(strength.localDate, run.localDate);
    return daysBefore === 0 || daysBefore === 1;
  });

  const matchesFilter = (strength: Session) =>
    strengthTitleContains === undefined || strength.title.toLowerCase().includes(strengthTitleContains.toLowerCase());

  if (precedingStrength.some(matchesFilter)) return { group: 'afterStrength', precedingStrength };
  if (precedingStrength.length > 0 || hasUntimedStrengthNearby) return { group: 'uncertain', precedingStrength };
  return { group: 'withoutRecentStrength', precedingStrength: [] };
}

function groupStats(runs: readonly Session[]): GroupStats {
  const paces = runs.map(paceSecondsPerKm).filter(isPresent);
  const heartRates = runs.map((run) => run.averageHeartRate).filter(isPresent);
  const medianPace = median(paces);
  const medianHeartRate = median(heartRates);

  return {
    runs: runs.length,
    medianSecondsPerKm: medianPace === null ? null : round2(medianPace),
    runsWithPace: paces.length,
    medianBpm: medianHeartRate === null ? null : round2(medianHeartRate),
    runsWithHeartRate: heartRates.length,
  };
}

function sameText(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}
