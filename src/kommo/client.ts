import { KommoApiError, KommoError, KommoRateLimitError } from "./errors.js";

export interface KommoClientOptions {
  subdomain: string;
  token: string;
  /** Minimum ms between requests. Default 260 (~3.8 req/s, under the 7 req/s cap). */
  minIntervalMs?: number;
  /** Max retries on 429. Default 5. */
  maxRateLimitRetries?: number;
  /** Max retries on 5xx / network errors. Default 3. */
  maxServerErrorRetries?: number;
  /** Per-request timeout in ms. Default 20000. */
  timeoutMs?: number;
  /** Structured logger. Receives NO secrets. Default: console. */
  logger?: Pick<Console, "debug" | "warn" | "error">;
}

export interface RequestOptions {
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  /** Extra non-auth headers. */
  headers?: Record<string, string>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const jitter = (ms: number) => ms * (0.5 + Math.random());

/**
 * Reusable Kommo API v4 client.
 * - Bearer auth over HTTPS, token never logged.
 * - Serial request queue with a minimum interval (rate-limit friendly).
 * - Retries 429 (honours Retry-After) and 5xx with exponential backoff + jitter.
 * - Detects a 403 straight after a 429 as a likely IP block and aborts.
 */
export class KommoClient {
  readonly baseUrl: string;
  private readonly token: string;
  private readonly minIntervalMs: number;
  private readonly maxRateLimitRetries: number;
  private readonly maxServerErrorRetries: number;
  private readonly timeoutMs: number;
  private readonly log: NonNullable<KommoClientOptions["logger"]>;

  private chain: Promise<unknown> = Promise.resolve();
  private lastStartedAt = 0;
  private sawRateLimit = false;

  constructor(opts: KommoClientOptions) {
    if (!opts.subdomain || !opts.token) throw new KommoError("KommoClient needs subdomain and token.");
    this.baseUrl = `https://${opts.subdomain}.kommo.com/api/v4`;
    this.token = opts.token;
    this.minIntervalMs = opts.minIntervalMs ?? 260;
    this.maxRateLimitRetries = opts.maxRateLimitRetries ?? 5;
    this.maxServerErrorRetries = opts.maxServerErrorRetries ?? 3;
    this.timeoutMs = opts.timeoutMs ?? 20_000;
    this.log = opts.logger ?? console;
  }

  get<T>(path: string, o: Omit<RequestOptions, "body"> = {}) {
    return this.request<T>("GET", path, o);
  }
  post<T>(path: string, body?: unknown, o: Omit<RequestOptions, "body"> = {}) {
    return this.request<T>("POST", path, { ...o, body });
  }
  patch<T>(path: string, body?: unknown, o: Omit<RequestOptions, "body"> = {}) {
    return this.request<T>("PATCH", path, { ...o, body });
  }
  delete<T>(path: string, o: RequestOptions = {}) {
    return this.request<T>("DELETE", path, o);
  }

  /** Queue a request behind all previous ones so the min-interval throttle holds globally. */
  request<T>(method: string, path: string, o: RequestOptions = {}): Promise<T> {
    const run = () => this.execute<T>(method, path, o);
    const queued = this.chain.then(run, run);
    // keep the chain going regardless of individual outcomes
    this.chain = queued.then(
      () => undefined,
      () => undefined,
    );
    return queued;
  }

  private async throttle(): Promise<void> {
    const wait = this.lastStartedAt + this.minIntervalMs - Date.now();
    if (wait > 0) await sleep(wait);
    this.lastStartedAt = Date.now();
  }

  private buildUrl(path: string, query?: RequestOptions["query"]): string {
    const url = new URL(this.baseUrl + (path.startsWith("/") ? path : `/${path}`));
    for (const [k, v] of Object.entries(query ?? {})) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
    return url.toString();
  }

  private async execute<T>(method: string, path: string, o: RequestOptions): Promise<T> {
    const url = this.buildUrl(path, o.query);
    let rateLimitTries = 0;
    let serverTries = 0;

    for (;;) {
      await this.throttle();

      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), this.timeoutMs);
      let res: Response;
      try {
        res = await fetch(url, {
          method,
          signal: ac.signal,
          headers: {
            Authorization: `Bearer ${this.token}`,
            Accept: "application/json",
            ...(o.body !== undefined ? { "Content-Type": "application/json" } : {}),
            ...o.headers,
          },
          body: o.body !== undefined ? JSON.stringify(o.body) : undefined,
        });
      } catch (err) {
        clearTimeout(timer);
        if (serverTries++ >= this.maxServerErrorRetries) {
          throw new KommoError(`Network error on ${method} ${path}: ${(err as Error).message}`);
        }
        const backoff = jitter(1000 * 2 ** (serverTries - 1));
        this.log.warn(`[kommo] network error on ${method} ${path}, retry ${serverTries} in ${Math.round(backoff)}ms`);
        await sleep(backoff);
        continue;
      } finally {
        clearTimeout(timer);
      }

      // 403 immediately after a 429 => likely IP block. Abort loudly.
      if (res.status === 403 && this.sawRateLimit) {
        throw new KommoRateLimitError(method, path, true);
      }

      if (res.status === 429) {
        this.sawRateLimit = true;
        if (rateLimitTries++ >= this.maxRateLimitRetries) {
          throw new KommoRateLimitError(method, path, false);
        }
        const retryAfter = Number(res.headers.get("retry-after"));
        const backoff =
          Number.isFinite(retryAfter) && retryAfter > 0
            ? retryAfter * 1000
            : jitter(1000 * 2 ** (rateLimitTries - 1));
        this.log.warn(`[kommo] 429 on ${method} ${path}, retry ${rateLimitTries} in ${Math.round(backoff)}ms`);
        await sleep(backoff);
        continue;
      }

      if (res.status >= 500) {
        if (serverTries++ >= this.maxServerErrorRetries) {
          throw new KommoApiError(res.status, method, path, await safeBody(res));
        }
        const backoff = jitter(1000 * 2 ** (serverTries - 1));
        this.log.warn(`[kommo] ${res.status} on ${method} ${path}, retry ${serverTries} in ${Math.round(backoff)}ms`);
        await sleep(backoff);
        continue;
      }

      this.log.debug?.(`[kommo] ${method} ${path} -> ${res.status}`);

      if (res.status === 204 || res.status === 202) return null as T;
      const body = await safeBody(res);
      if (!res.ok) throw new KommoApiError(res.status, method, path, body);
      return body as T;
    }
  }
}

async function safeBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
