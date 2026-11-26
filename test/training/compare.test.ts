import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { demoActivities } from '../../src/demo/demo-activities.ts';
import { classifyRun, compareRunsAfterStrength } from '../../src/training/compare.ts';
import { toSessions } from '../../src/training/sessions.ts';
import { runActivity, sessionOf, strengthActivity, TODAY } from '../helpers.ts';

const LAST_SIX_WEEKS = { start: '2026-10-15', end: TODAY };

describe('classifyRun', () => {
  const run = sessionOf(runActivity('2026-11-20 07:00:00'));

  it('counts a matching strength session from the previous evening', () => {
    const legDay = sessionOf(strengthActivity('2026-11-19 18:00:00', 'Piernas'));
    assert.equal(classifyRun(run, [legDay], 'piernas').group, 'afterStrength');
  });

  it('counts any strength session when no title filter is given', () => {
    assert.equal(classifyRun(run, [sessionOf(strengthActivity('2026-11-19 18:00:00'))]).group, 'afterStrength');
  });

  it('ignores strength more than 24 hours before, or after the run started', () => {
    const tooEarly = sessionOf(strengthActivity('2026-11-19 06:59:00'));
    const afterwards = sessionOf(strengthActivity('2026-11-20 18:00:00'));
    assert.equal(classifyRun(run, [tooEarly, afterwards]).group, 'withoutRecentStrength');
  });

  it('is uncertain when recent strength has a title that does not say whether it was leg day', () => {
    const generic = sessionOf(strengthActivity('2026-11-19 18:00:00', 'Strength'));
    const result = classifyRun(run, [generic], 'Piernas');
    assert.equal(result.group, 'uncertain');
    assert.deepEqual(
      result.precedingStrength.map((session) => session.title),
      ['Strength'],
    );
  });

  it('is uncertain when start times needed for the 24-hour window are missing', () => {
    const untimedRun = sessionOf(runActivity('2026-11-20 07:00:00', { startTimeGMT: undefined }));
    const untimedStrength = sessionOf(strengthActivity('2026-11-19 18:00:00', 'Strength', { startTimeGMT: undefined }));
    assert.equal(classifyRun(untimedRun, []).group, 'uncertain');
    assert.equal(classifyRun(run, [untimedStrength]).group, 'uncertain');
  });
});

describe('compareRunsAfterStrength', () => {
  it('keeps unidentified gym sessions out of the rested baseline', () => {
    const activities = demoActivities(TODAY);
    activities[0]!.activityName = 'Strength'; // the most recent leg day loses its label

    const result = compareRunsAfterStrength(toSessions(activities), { range: LAST_SIX_WEEKS, runTitle: 'Park 5K', strengthTitleContains: 'leg' });

    assert.equal(result.afterStrength.runs, 2);
    assert.equal(result.withoutRecentStrength.runs, 3);
    assert.equal(result.uncertainRuns, 1);
    assert.equal(result.evidence.length, 6);
  });

  it('only considers runs with the exact title inside the range', () => {
    const sessions = toSessions([
      runActivity('2026-11-20 07:00:00', { activityName: 'park 5k' }),
      runActivity('2026-11-21 07:00:00', { activityName: 'Park 5K long' }),
      runActivity('2026-10-01 07:00:00', { activityName: 'Park 5K' }),
    ]);
    const result = compareRunsAfterStrength(sessions, { range: LAST_SIX_WEEKS, runTitle: 'Park 5K' });
    assert.deepEqual(
      result.evidence.map((entry) => entry.run.localStart.slice(0, 10)),
      ['2026-11-20'],
    );
  });

  it('reports median pace and heart rate per group', () => {
    const sessions = toSessions([
      strengthActivity('2026-11-19 18:00:00'),
      runActivity('2026-11-20 07:00:00', { duration: 1600, averageHR: 160 }),
      runActivity('2026-11-22 07:00:00', { duration: 1500, averageHR: 150 }),
      runActivity('2026-11-24 07:00:00', { duration: 1520, averageHR: 154 }),
    ]);
    const result = compareRunsAfterStrength(sessions, { range: LAST_SIX_WEEKS, runTitle: 'Park 5K' });

    assert.deepEqual(result.afterStrength, { runs: 1, medianSecondsPerKm: 320, runsWithPace: 1, medianBpm: 160, runsWithHeartRate: 1 });
    assert.deepEqual(result.withoutRecentStrength, { runs: 2, medianSecondsPerKm: 302, runsWithPace: 2, medianBpm: 152, runsWithHeartRate: 2 });
  });
});
