import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

export interface Recording {
  activityId: number | string;
  activityName?: string;
  activityType?: { typeKey?: string; parentTypeId?: number };
  startTimeLocal: string;
  startTimeGMT?: string;
  duration?: number;
  distance?: number;
  averageHR?: number;
}

const base = 'https://personal.connectapi.garmin.com';
let token = '';
let renewAt = 0;

async function checkedFetch(url: URL | string, options: RequestInit) {
  const response = await fetch(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(20000) });
  if (!response.ok) {
    throw new Error(`Garmin returned HTTP ${response.status}. Check the key for 401/403, or retry later for 429/5xx.`);
  }
  return response;
}

async function accessToken() {
  if (token && Date.now() < renewAt) return token;
  const keyFile = join(homedir(), '.config', 'garmin', 'connect-personal-api-key');
  const key = process.env.GARMIN_PERSONAL_API_KEY?.trim() || (await readFile(keyFile, 'utf8').catch(() => '')).trim();
  if (!key) throw new Error('Set up your Garmin Personal API key locally as described in README.md, or start with --demo.');
  const response = await checkedFetch(base + '/personalapitoken-service/personal-api/personal-api-key/token', {
    method: 'POST', headers: { Authorization: 'ApiKey ' + key }
  });
  // Garmin documents the token as a JWT but not the response envelope, so accept a bare token or JSON with access_token.
  const body = (await response.text()).trim();
  let value: unknown = body;
  if (body.startsWith('{')) value = (() => { try { return JSON.parse(body)?.access_token; } catch { return ''; } })();
  token = typeof value === 'string' ? value.trim() : '';
  if (!token) throw new Error('Garmin returned no usable access token.');
  renewAt = Date.now() + 23 * 3600000;
  return token;
}

/** Authenticated GET against the Personal API. Clears the cached token on failure so the next call re-exchanges the key. */
export async function garminGet(path: URL | string) {
  try {
    return await checkedFetch(new URL(path, base), { headers: { Authorization: 'Bearer ' + await accessToken() } });
  } catch (error) {
    token = '';
    throw error;
  }
}

export async function fetchRecordings(first: string, last: string): Promise<Recording[]> {
  const rows = new Map<string, Recording>();
  const url = new URL('/activitylist-service/activities/search/activities', base);
  const pageSize = 50;
  url.search = new URLSearchParams({ startDate: first, endDate: last, limit: String(pageSize) }).toString();
  for (let offset = 0; ; ) {
    url.searchParams.set('start', String(offset));
    const page = await (await garminGet(url)).json();
    if (!Array.isArray(page)) throw new Error('Unexpected Garmin activity list format.');
    if (!page.length) break;
    const previousSize = rows.size;
    for (const row of page) {
      if (row?.activityId == null || typeof row.startTimeLocal !== 'string') throw new Error('Incomplete Garmin activity record.');
      rows.set(String(row.activityId), row);
    }
    if (rows.size === previousSize) throw new Error('Garmin repeated a page. Retry before interpreting the results.');
    offset += page.length;
    if (page.length < pageSize) break;
  }
  return [...rows.values()];
}
