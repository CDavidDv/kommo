/**
 * Read-only connection check. Does NOT modify the Kommo account.
 *   npm run verify
 */
import { loadKommoEnv, describeToken } from "../config/env.js";
import { kommoFromEnv } from "../kommo/index.js";
import { KommoApiError, KommoRateLimitError } from "../kommo/index.js";

interface AccountResponse {
  id: number;
  name: string;
  subdomain: string;
  created_at?: number;
  currency?: string;
  currency_symbol?: string;
  country?: string;
  _embedded?: { users?: unknown[] };
}

interface UserListResponse {
  _page?: number;
  _embedded?: { users?: Array<{ id: number; name: string; email: string }> };
}

async function main() {
  const env = loadKommoEnv();
  const meta = describeToken(env.token);

  console.log("Kommo connection check (read-only)\n");
  console.log(`Subdomain:      ${env.subdomain}.kommo.com`);
  if (meta?.accountId) console.log(`Token account:  ${meta.accountId}`);
  if (meta?.scopes) console.log(`Token scopes:   ${meta.scopes.join(", ")}`);
  if (meta?.expiresAt) {
    const days = Math.round((meta.expiresAt.getTime() - Date.now()) / 86_400_000);
    console.log(`Token expires:  ${meta.expiresAt.toISOString().slice(0, 10)} (${days} days${meta.expired ? " — EXPIRED" : ""})`);
  }
  console.log("");

  const kommo = kommoFromEnv();

  try {
    const account = await kommo.get<AccountResponse>("/account", {
      query: { with: "task_types,users_groups,version,amojo_id" },
    });

    console.log("Kommo connection: OK");
    console.log(`Account:          ${account.name}`);
    console.log(`Subdomain:        ${account.subdomain}`);
    console.log(`Account ID:       ${account.id}`);
    if (account.currency) console.log(`Currency:         ${account.currency}`);
    if (account.country) console.log(`Country:          ${account.country}`);
    if (account.created_at) console.log(`Created:          ${new Date(account.created_at * 1000).toISOString().slice(0, 10)}`);

    if (meta?.accountId && meta.accountId !== account.id) {
      console.warn(`\n⚠  Token account_id (${meta.accountId}) != /account id (${account.id}).`);
    }

    // Second read-only call: confirms 'crm' scope + admin (users list is admin-only).
    try {
      const users = await kommo.get<UserListResponse>("/users", { query: { limit: 5 } });
      const n = users._embedded?.users?.length ?? 0;
      console.log(`\nUsers readable:   yes (${n}${n === 5 ? "+" : ""} shown) — admin token confirmed`);
    } catch (e) {
      if (e instanceof KommoApiError && e.status === 403) {
        console.log("\nUsers readable:   NO (403) — token is not admin or lacks scope");
      } else {
        throw e;
      }
    }

    console.log("\nNothing was modified.");
  } catch (err) {
    console.error("\nKommo connection: FAILED");
    if (err instanceof KommoRateLimitError) {
      console.error(err.message);
    } else if (err instanceof KommoApiError) {
      console.error(err.message);
      if (err.status === 401) console.error("→ Regenerate the long-lived token in the private integration.");
    } else {
      console.error((err as Error).message);
    }
    process.exit(1);
  }
}

main();
