import { config as loadDotenv } from "dotenv";

loadDotenv();

export interface KommoEnv {
  subdomain: string;
  token: string;
  /** Optional — only for Salesbot/widget JWT validation. */
  clientSecret?: string;
  integrationId?: string;
}

class EnvError extends Error {}

function req(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new EnvError(`Missing required env var: ${name}. Copy .env.example to .env and fill it.`);
  return v;
}

function opt(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v ? v : undefined;
}

/** Reads + validates Kommo credentials from the environment. Never logs values. */
export function loadKommoEnv(): KommoEnv {
  let subdomain = req("KOMMO_SUBDOMAIN");

  // Tolerate a full URL / host being pasted; keep only the subdomain label.
  subdomain = subdomain
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .replace(/\.kommo\.com$/i, "")
    .replace(/\.amocrm\.(com|ru)$/i, "");

  if (!/^[a-z0-9][a-z0-9-]*$/i.test(subdomain)) {
    throw new EnvError(`KOMMO_SUBDOMAIN looks invalid after normalization: "${subdomain}"`);
  }

  const token = req("KOMMO_LONG_LIVED_TOKEN");
  if (token.split(".").length !== 3) {
    throw new EnvError("KOMMO_LONG_LIVED_TOKEN does not look like a JWT (expected 3 dot-separated parts).");
  }

  return {
    subdomain,
    token,
    clientSecret: opt("KOMMO_CLIENT_SECRET"),
    integrationId: opt("KOMMO_INTEGRATION_ID"),
  };
}

/** Non-secret metadata decoded from the token payload. Returns null on any failure. */
export function describeToken(token: string): {
  accountId?: number;
  expiresAt?: Date;
  scopes?: string[];
  expired?: boolean;
} | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const json = JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
    const expiresAt = typeof json.exp === "number" ? new Date(json.exp * 1000) : undefined;
    return {
      accountId: typeof json.account_id === "number" ? json.account_id : undefined,
      expiresAt,
      scopes: Array.isArray(json.scopes) ? json.scopes : undefined,
      expired: expiresAt ? expiresAt.getTime() < Date.now() : undefined,
    };
  } catch {
    return null;
  }
}
