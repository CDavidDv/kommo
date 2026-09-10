import { loadKommoEnv } from "../config/env.js";
import { KommoClient, type KommoClientOptions } from "./client.js";

export { KommoClient } from "./client.js";
export { collectAll } from "./paginate.js";
export { KommoError, KommoApiError, KommoRateLimitError } from "./errors.js";
export type { KommoClientOptions, RequestOptions } from "./client.js";

/** Build a client from validated environment variables. */
export function kommoFromEnv(overrides: Partial<KommoClientOptions> = {}): KommoClient {
  const env = loadKommoEnv();
  return new KommoClient({ subdomain: env.subdomain, token: env.token, ...overrides });
}
