import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { summarizeSession, toSession, toSessions } from '../../src/training/sessions.ts';
import { garminActivity, runActivity, sessionOf, strengthActivity } from '../helpers.ts';

describe('toSession', () => {
  it('recognizes running variants and strength training, and ignores other sports', () => {
    assert.equal(toSession(garminActivity('trail_running', '2026-11-20 07:00:00'))?.sport, 'running');
    assert.equal(toSession(garminActivity('treadmill_running', '2026-11-20 07:00:00'))?.sport, 'running');
    assert.equal(toSession(garminActivity('strength_training', '2026-11-20 07:00:00'))?.sport, 'strength');
    assert.equal(toSession(garminActivity('cycling', '2026-11-20 07:00:00')), null);
    assert.equal(toSession(garminActivity('', '2026-11-20 07:00:00')), null);
  });

  it('turns missing or non-positive metrics into null', () => {
    const session = sessionOf(runActivity('2026-11-20 07:00:00', { duration: 0, distance: undefined, averageHR: -1 }));
    assert.equal(session.durationSeconds, null);
    assert.equal(session.distanceMeters, null);
    assert.equal(session.averageHeartRate, null);
  });

  it('ignores distance on strength sessions', () => {
    assert.equal(sessionOf(strengthActivity('2026-11-20 18:00:00', 'Strength', { distance: 120 })).distanceMeters, null);
  });

  it('reads the UTC start, with or without a zone suffix, and tolerates its absence', () => {
    const expected = Date.parse('2026-11-20T11:00:00Z');
    assert.equal(sessionOf(runActivity('2026-11-20 07:00:00', { startTimeGMT: '2026-11-20 11:00:00' })).startedAtMs, expected);
    assert.equal(sessionOf(runActivity('2026-11-20 07:00:00', { startTimeGMT: '2026-11-20T11:00:00Z' })).startedAtMs, expected);
    assert.equal(sessionOf(runActivity('2026-11-20 07:00:00', { startTimeGMT: undefined })).startedAtMs, null);
  });
});

describe('toSessions', () => {
  it('drops untracked sports and sorts oldest first', () => {
    const sessions = toSessions([
      strengthActivity('2026-11-22 18:00:00'),
      garminActivity('cycling', '2026-11-21 08:00:00'),
      runActivity('2026-11-20 07:00:00'),
    ]);
    assert.deepEqual(
      sessions.map((session) => session.localDate),
      ['2026-11-20', '2026-11-22'],
    );
  });
});

describe('summarizeSession', () => {
  it('reports weekday, display units and pace so the assistant need not derive them', () => {
    const summary = summarizeSession(sessionOf(runActivity('2026-11-20 17:44:54', { duration: 2766, distance: 6010, averageHR: 142 })));
    assert.equal(summary.weekday, 'Friday');
    assert.equal(summary.minutes, 46.1);
    assert.equal(summary.km, 6.01);
    assert.equal(summary.secondsPerKm, 460); // 7:40 per km
    assert.equal(summary.averageBpm, 142);
  });

  it('has no pace without both duration and distance', () => {
    assert.equal(summarizeSession(sessionOf(strengthActivity('2026-11-22 18:00:00'))).secondsPerKm, null);
  });
});
