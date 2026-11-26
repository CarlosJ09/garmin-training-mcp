import type { Recording } from './garmin.mts';

const dayMs = 86400000;
export const today = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: process.env.TRAINING_TIME_ZONE || 'America/Santo_Domingo',
  year: 'numeric', month: '2-digit', day: '2-digit'
}).format(new Date());

export function parseDay(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Use a date in YYYY-MM-DD format.');
  const timestamp = Date.parse(value + 'T00:00:00Z');
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) throw new Error('Invalid calendar date.');
  return value;
}

export const shiftDay = (day: string, days: number) => new Date(Date.parse(day) + days * dayMs).toISOString().slice(0, 10);
const positive = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;
const round = (n: number) => Math.round(n * 100) / 100;
const localDay = (r: Recording) => r.startTimeLocal.slice(0, 10);
const title = (r: Recording) => r.activityName?.trim() || '';
const sport = (r: Recording) => r.activityType?.typeKey || '';
const isRun = (r: Recording) => sport(r).split('_').includes('running');
const isLift = (r: Recording) => sport(r) === 'strength_training';
function utcStart(r: Recording) {
  const t = r.startTimeGMT?.replace(' ', 'T');
  return t ? Date.parse(/Z$|[+-]\d\d:\d\d$/.test(t) ? t : t + 'Z') : NaN;
}

// Computed here so the assistant never has to derive calendar facts or arithmetic itself.
const weekday = (r: Recording) => new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' }).format(new Date(localDay(r) + 'T00:00:00Z'));

function session(r: Recording) {
  const km = isRun(r) && positive(r.distance) ? r.distance / 1000 : null;
  return {
    id: String(r.activityId), title: title(r), weekday: weekday(r), localStart: r.startTimeLocal, sport: sport(r),
    minutes: positive(r.duration) ? round(r.duration / 60) : null,
    km: km === null ? null : round(km),
    secondsPerKm: km !== null && positive(r.duration) ? Math.round(r.duration / km) : null,
    averageBpm: positive(r.averageHR) ? r.averageHR : null
  };
}

export function week(rows: Recording[], first: string, last: string) {
  const eligible = rows.filter(r => localDay(r) >= first && localDay(r) <= last && (isRun(r) || isLift(r)));
  const sessions = eligible.sort((a,b) => a.startTimeLocal.localeCompare(b.startTimeLocal)).map(session);
  const runs = eligible.filter(isRun);
  return { first, last, runs: runs.length, strengthSessions: eligible.filter(isLift).length,
    recordedRunKm: round(runs.reduce((sum,r) => sum + (positive(r.distance) ? r.distance : 0), 0) / 1000),
    recordedTrainingMinutes: round(eligible.reduce((sum,r) => sum + (positive(r.duration) ? r.duration : 0), 0) / 60),
    sessions };
}

function median(values: number[]) {
  if (!values.length) return null;
  values.sort((a,b) => a-b);
  return round((values[Math.floor((values.length-1)/2)] + values[Math.floor(values.length/2)]) / 2);
}

export function compare(rows: Recording[], first: string, last: string, runTitle: string, legTitle?: string) {
  const groups = { afterLifting: [] as Recording[], withoutRecentLifting: [] as Recording[], uncertain: [] as Recording[] };
  const lifts = rows.filter(isLift);
  const evidence = [];
  for (const run of rows.filter(isRun)) {
    if (localDay(run) < first || localDay(run) > last || title(run).toLowerCase() !== runTitle.toLowerCase()) continue;
    const start = utcStart(run);
    const nearby = lifts.filter(lift => Math.abs(Date.parse(localDay(lift)) - Date.parse(localDay(run))) <= 2 * dayMs);
    const previous = nearby.filter(lift => {
      const gap = start - utcStart(lift);
      return gap > 0 && gap <= dayMs;
    });
    const tagged = previous.some(lift => !legTitle || title(lift).toLowerCase().includes(legTitle.toLowerCase()));
    let group: keyof typeof groups = 'withoutRecentLifting';
    if (tagged) group = 'afterLifting';
    else if (!Number.isFinite(start) || nearby.some(lift => !Number.isFinite(utcStart(lift))) || previous.length) group = 'uncertain';
    groups[group].push(run);
    evidence.push({ run: session(run), group, precedingStrength: previous.map(session) });
  }
  function stats(items: Recording[]) {
    const paces = items.filter(r => positive(r.duration) && positive(r.distance)).map(r => r.duration! / (r.distance! / 1000));
    const heartRates = items.map(r => r.averageHR).filter(positive);
    return { runs: items.length, medianSecondsPerKm: median(paces), runsWithPace: paces.length,
      medianBpm: median(heartRates), runsWithHeartRate: heartRates.length };
  }
  return { first, last, exactRunTitle: runTitle, strengthTitleContains: legTitle ?? null,
    comparison: 'Same recorded run title. Check distances and conditions. Window is 24 hours between session starts.',
    afterLifting: stats(groups.afterLifting), withoutRecentLifting: stats(groups.withoutRecentLifting),
    uncertainRuns: groups.uncertain.length, evidence };
}

export function demoRows(anchor: string): Recording[] {
  const rows: Recording[] = [];
  for (let i = 0; i < 6; i++) {
    const day = shiftDay(anchor, -i * 4);
    const legDay = i % 2 === 0;
    const add = (date: string, time: string, name: string, type: string, seconds: number, meters?: number, bpm?: number) => {
      const local = date + 'T' + time + ':00';
      rows.push({ activityId: 'sample-' + rows.length, activityName: name, activityType: { typeKey: type },
        startTimeLocal: local, startTimeGMT: new Date(Date.parse(local + '-04:00')).toISOString(),
        duration: seconds, distance: meters, averageHR: bpm });
    };
    if (legDay) add(shiftDay(day, -1), '18:00', 'Leg day', 'strength_training', 2700);
    add(day, '07:00', 'Park 5K', 'running', 1600 + (legDay ? 30 : 0) + i * 2, 5000, 145 + i);
  }
  return rows;
}
