import { GarminApiError } from './errors.ts';

const TOKEN_PATH = '/personalapitoken-service/personal-api/personal-api-key/token';
/** Garmin access tokens last 24 hours. Renew an hour early, as Garmin's reference client does. */
const TOKEN_REUSE_MS = 23 * 60 * 60 * 1000;
const DEFAULT_TIMEOUT_MS = 20_000;

export interface GarminClientOptions {
  baseUrl: string;
  /** Called only when a new access token is needed. */
  getApiKey: () => Promise<string>;
  fetch?: typeof fetch;
  now?: () => number;
  timeoutMs?: number;
}

/**
 * Authenticated access to the Garmin Connect Personal API.
 * Exchanges the API key for an access token on first use and caches it in memory only.
 */
export class GarminClient {
  readonly #baseUrl: string;
  readonly #getApiKey: () => Promise<string>;
  readonly #fetch: typeof fetch;
  readonly #now: () => number;
  readonly #timeoutMs: number;
  #token: { value: string; reuseUntil: number } | undefined;

  constructor(options: GarminClientOptions) {
    this.#baseUrl = options.baseUrl;
    this.#getApiKey = options.getApiKey;
    this.#fetch = options.fetch ?? ((input, init) => fetch(input, init));
    this.#now = options.now ?? Date.now;
    this.#timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async get(path: string, query: Record<string, string> = {}): Promise<Response> {
    const url = new URL(path, this.#baseUrl);
    for (const [name, value] of Object.entries(query)) url.searchParams.set(name, value);

    const token = await this.#accessToken();
    try {
      return await this.#send(url, { headers: { Authorization: `Bearer ${token}` } });
    } catch (error) {
      // A rejected token may have been revoked early; exchange the key again next time.
      if (error instanceof GarminApiError && error.isAuthError) this.#token = undefined;
      throw error;
    }
  }

  async getJson(path: string, query?: Record<string, string>): Promise<unknown> {
    return (await this.get(path, query)).json();
  }

  async #accessToken(): Promise<string> {
    if (this.#token && this.#now() < this.#token.reuseUntil) return this.#token.value;

    const apiKey = await this.#getApiKey();
    const response = await this.#send(new URL(TOKEN_PATH, this.#baseUrl), {
      method: 'POST',
      headers: { Authorization: `ApiKey ${apiKey}` },
    });
    const value = parseAccessToken(await response.text());
    this.#token = { value, reuseUntil: this.#now() + TOKEN_REUSE_MS };
    return value;
  }

  async #send(url: URL, init: RequestInit): Promise<Response> {
    const response = await this.#fetch(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(this.#timeoutMs) });
    if (!response.ok) throw new GarminApiError(response.status);
    return response;
  }
}

/**
 * Garmin documents the access token as a JWT but not the response envelope,
 * so accept either the bare token or `{ "access_token": "..." }`.
 */
export function parseAccessToken(body: string): string {
  const trimmed = body.trim();
  const token = trimmed.startsWith('{') ? accessTokenField(trimmed) : trimmed;
  if (!token) throw new Error('Garmin returned no usable access token.');
  return token;
}

function accessTokenField(json: string): string {
  try {
    const parsed: unknown = JSON.parse(json);
    if (typeof parsed === 'object' && parsed !== null && 'access_token' in parsed && typeof parsed.access_token === 'string') {
      return parsed.access_token.trim();
    }
  } catch {
    // Fall through: malformed JSON carries no token.
  }
  return '';
}
