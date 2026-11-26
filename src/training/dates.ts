/** A calendar date in ISO format, "YYYY-MM-DD". ISO dates sort correctly as strings. */
export type IsoDate = string;

/** An inclusive range of calendar dates. */
export interface DateRange {
  start: IsoDate;
  end: IsoDate;
}

export const DAY_MS = 24 * 60 * 60 * 1000;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** True for a real calendar date in YYYY-MM-DD form. Rejects impossible dates such as 2026-02-31. */
export function isIsoDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

/** Today's date in the given IANA time zone. */
export function todayIn(timeZone: string, now: Date = new Date()): IsoDate {
  // The en-CA locale formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return new Date(toUtcMidnight(date) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((toUtcMidnight(to) - toUtcMidnight(from)) / DAY_MS);
}

/** English weekday name, for example "Friday". */
export function weekdayOf(date: IsoDate): string {
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' }).format(toUtcMidnight(date));
}

export function isWithin(date: IsoDate, range: DateRange): boolean {
  return date >= range.start && date <= range.end;
}

/** The seven calendar days ending on, and including, `end`. */
export function weekEndingOn(end: IsoDate): DateRange {
  return { start: addDays(end, -6), end };
}

function toUtcMidnight(date: IsoDate): number {
  return Date.parse(`${date}T00:00:00Z`);
}
