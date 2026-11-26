import type { GarminClient } from './client.ts';
import type { GarminActivity } from './types.ts';

const SEARCH_PATH = '/activitylist-service/activities/search/activities';
const PAGE_SIZE = 50;

/**
 * Every activity whose local start date is between startDate and endDate (inclusive, YYYY-MM-DD).
 * Follows pagination and drops duplicates, which Garmin can return when activities sync mid-request.
 */
export async function searchActivities(client: GarminClient, startDate: string, endDate: string): Promise<GarminActivity[]> {
  const byId = new Map<string, GarminActivity>();

  for (let offset = 0; ; ) {
    const page = await client.getJson(SEARCH_PATH, {
      startDate,
      endDate,
      start: String(offset),
      limit: String(PAGE_SIZE),
    });
    if (!Array.isArray(page)) throw new Error('Unexpected Garmin activity list format.');

    const knownBefore = byId.size;
    for (const item of page) {
      const activity = parseActivity(item);
      byId.set(String(activity.activityId), activity);
    }

    if (page.length < PAGE_SIZE) break;
    if (byId.size === knownBefore) throw new Error('Garmin returned a repeated page. Retry before interpreting the results.');
    offset += page.length;
  }

  return [...byId.values()];
}

function parseActivity(item: unknown): GarminActivity {
  const isComplete =
    typeof item === 'object' && item !== null && 'activityId' in item && item.activityId != null && 'startTimeLocal' in item && typeof item.startTimeLocal === 'string';
  if (!isComplete) throw new Error('Garmin returned an incomplete activity record.');
  return item as GarminActivity;
}
