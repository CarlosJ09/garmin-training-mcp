/**
 * The subset of a Garmin Connect activity-list item that this project reads.
 * Garmin omits fields a session didn't record, so everything except the id and start is optional.
 */
export interface GarminActivity {
  activityId: number | string;
  activityName?: string;
  activityType?: { typeKey?: string };
  /** Local wall-clock start, "YYYY-MM-DD HH:mm:ss". */
  startTimeLocal: string;
  /** UTC start, "YYYY-MM-DD HH:mm:ss" without a zone suffix. */
  startTimeGMT?: string;
  /** Seconds. */
  duration?: number;
  /** Meters. */
  distance?: number;
  /** Beats per minute. */
  averageHR?: number;
}
