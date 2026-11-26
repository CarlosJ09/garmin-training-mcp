/** A non-success HTTP response from the Garmin Personal API. */
export class GarminApiError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(describeStatus(status));
    this.name = 'GarminApiError';
    this.status = status;
  }

  get isAuthError(): boolean {
    return this.status === 401 || this.status === 403;
  }
}

function describeStatus(status: number): string {
  if (status === 401 || status === 403) return `Garmin rejected the API key (HTTP ${status}). Check that it is valid and hasn't expired.`;
  if (status === 404) return 'Garmin has no such resource (HTTP 404).';
  if (status === 429) return 'Garmin is rate-limiting requests (HTTP 429). Retry later.';
  if (status >= 500) return `Garmin is unavailable (HTTP ${status}). Retry later.`;
  return `Garmin request failed (HTTP ${status}).`;
}
