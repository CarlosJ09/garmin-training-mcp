import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { demoActivities } from '../../src/demo/demo-activities.ts';
import { weekEndingOn } from '../../src/training/dates.ts';
import { toSessions } from '../../src/training/sessions.ts';
import { summarizeWeek } from '../../src/training/week.ts';
import { runActivity, strengthActivity, TODAY } from '../helpers.ts';

describe('summarizeWeek', () => {
  it('totals the demo week', () => {
    const week = summarizeWeek(toSessions(demoActivities(TODAY)), weekEndingOn(TODAY));
    assert.equal(week.startDate, '2026-11-19');
    assert.equal(week.runs, 2);
    assert.equal(week.strengthSessions, 1);
    assert.equal(week.recordedRunKm, 10);
  });

  it('includes both boundary days and excludes the days outside', () => {
    const sessions = toSessions([
      runActivity('2026-11-18 07:00:00'),
      runActivity('2026-11-19 07:00:00'),
      runActivity('2026-11-25 07:00:00'),
      runActivity('2026-11-26 07:00:00'),
    ]);
    const week = summarizeWeek(sessions, weekEndingOn(TODAY));
    assert.deepEqual(
      week.sessions.map((session) => session.localStart.slice(0, 10)),
      ['2026-11-19', '2026-11-25'],
    );
  });

  it('counts only recorded distance and duration', () => {
    const sessions = toSessions([
      runActivity('2026-11-20 07:00:00', { distance: 6010, duration: 2766 }),
      runActivity('2026-11-21 07:00:00', { distance: undefined, duration: undefined }),
      strengthActivity('2026-11-22 18:00:00', 'Strength', { duration: 4538 }),
    ]);
    const week = summarizeWeek(sessions, weekEndingOn(TODAY));
    assert.equal(week.runs, 2);
    assert.equal(week.recordedRunKm, 6.01);
    assert.equal(week.recordedTrainingMinutes, 121.73);
  });
});
