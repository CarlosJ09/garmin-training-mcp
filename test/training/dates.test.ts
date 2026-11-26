import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { addDays, daysBetween, isIsoDate, todayIn, weekdayOf, weekEndingOn } from '../../src/training/dates.ts';

describe('isIsoDate', () => {
  it('accepts real calendar dates, including leap days', () => {
    assert.equal(isIsoDate('2026-11-25'), true);
    assert.equal(isIsoDate('2028-02-29'), true);
  });

  it('rejects impossible dates and other formats', () => {
    for (const value of ['2026-02-31', '2027-02-29', '2026-13-01', '2026-1-5', '25/11/2026', '']) {
      assert.equal(isIsoDate(value), false, value);
    }
  });
});

describe('date arithmetic', () => {
  it('adds days across month and year boundaries', () => {
    assert.equal(addDays('2026-12-30', 3), '2027-01-02');
    assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  });

  it('counts whole days between dates', () => {
    assert.equal(daysBetween('2026-11-19', '2026-11-25'), 6);
    assert.equal(daysBetween('2026-11-25', '2026-11-19'), -6);
  });

  it('builds an inclusive seven-day week', () => {
    assert.deepEqual(weekEndingOn('2026-11-25'), { start: '2026-11-19', end: '2026-11-25' });
  });

  it('names the weekday', () => {
    assert.equal(weekdayOf('2026-11-20'), 'Friday');
  });
});

describe('todayIn', () => {
  it('uses the calendar date of the given time zone, not UTC', () => {
    const lateEveningInSantoDomingo = new Date('2026-11-26T02:00:00Z');
    assert.equal(todayIn('America/Santo_Domingo', lateEveningInSantoDomingo), '2026-11-25');
    assert.equal(todayIn('UTC', lateEveningInSantoDomingo), '2026-11-26');
  });
});
