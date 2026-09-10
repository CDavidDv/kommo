/**
 * Read-only inventory of the Kommo account. Does NOT modify anything.
 *   npm run audit
 * Output: docs/current-account.json  +  docs/current-account.md
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describeToken, loadKommoEnv } from "../config/env.js";
import { collectAll, kommoFromEnv, KommoApiError } from "../kommo/index.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_JSON = resolve(HERE, "../../docs/current-account.json");
const OUT_MD = resolve(HERE, "../../docs/current-account.md");

type Section<T> = { available: true; count: number; items: T } | { available: false; reason: string };

async function section<T>(label: string, fn: () => Promise<T>, count: (v: T) => number): Promise<Section<T>> {
  try {
    const items = await fn();
    const n = count(items);
    console.log(`  ${label.padEnd(22)} ${n}`);
    return { available: true, count: n, items };
  } catch (err) {
    const reason =
      err instanceof KommoApiError ? `HTTP ${err.status}` : (err as Error).message;
    console.log(`  ${label.padEnd(22)} — unavailable (${reason})`);
    return { available: false, reason };
  }
}

async function main() {
  const env = loadKommoEnv();
  const kommo = kommoFromEnv();
  console.log(`Auditing ${env.subdomain}.kommo.com (read-only)\n`);

  const account = await kommo.get<Record<string, unknown>>("/account", {
    query: { with: "task_types,users_groups,version,amojo_id,datetime_settings" },
  });

  const pipelines = await section(
    "pipelines",
    () => collectAll<Record<string, unknown>>(kommo, "/leads/pipelines", "pipelines"),
    (v) => v.length,
  );

  // Stages come embedded in each pipeline; expose a flat count too.
  let stageCount = 0;
  if (pipelines.available) {
    for (const p of pipelines.items as Array<Record<string, any>>) {
      stageCount += p._embedded?.statuses?.length ?? 0;
    }
    console.log(`  ${"stages (total)".padEnd(22)} ${stageCount}`);
  }

  const entities = ["leads", "contacts", "companies"] as const;

  const customFields: Record<string, Section<unknown[]>> = {};
  for (const e of entities) {
    customFields[e] = await section(
      `custom fields: ${e}`,
      () => collectAll<unknown>(kommo, `/${e}/custom_fields`, "custom_fields"),
      (v) => v.length,
    );
  }

  const fieldGroups: Record<string, Section<unknown[]>> = {};
  for (const e of entities) {
    fieldGroups[e] = await section(
      `field groups: ${e}`,
      () => collectAll<unknown>(kommo, `/${e}/custom_fields/groups`, "custom_field_groups"),
      (v) => v.length,
    );
  }

  const tags: Record<string, Section<unknown[]>> = {};
  for (const e of entities) {
    tags[e] = await section(
      `tags: ${e}`,
      () => collectAll<unknown>(kommo, `/${e}/tags`, "tags"),
      (v) => v.length,
    );
  }

  const users = await section(
    "users",
    () => collectAll<unknown>(kommo, "/users", "users", { with: "role,group" }),
    (v) => v.length,
  );

  const lossReasons = await section(
    "loss reasons",
    () => collectAll<unknown>(kommo, "/leads/loss_reasons", "loss_reasons"),
    (v) => v.length,
  );

  const bots = await section(
    "salesbots",
    () => collectAll<unknown>(kommo, "/bots", "bots"),
    (v) => v.length,
  );

  const webhooks = await section(
    "webhooks",
    () => collectAll<unknown>(kommo, "/webhooks", "webhooks"),
    (v) => v.length,
  );

  const pipelineCount = pipelines.available ? pipelines.count : 0;
  const taskTypes = (account as any)?._embedded?.task_types ?? [];

  const report = {
    _meta: {
      generatedAt: new Date().toISOString(),
      subdomain: env.subdomain,
      tokenExpiresAt: describeToken(env.token)?.expiresAt?.toISOString() ?? null,
      note: "Read-only snapshot. Nothing was modified. This file is gitignored (may contain account data).",
    },
    account,
    taskTypes,
    pipelines,
    stageCountTotal: stageCount,
    users,
    customFields,
    fieldGroups,
    tags,
    lossReasons,
    bots,
    webhooks,
  };

  await mkdir(dirname(OUT_JSON), { recursive: true });
  await writeFile(OUT_JSON, JSON.stringify(report, null, 2) + "\n", "utf8");

  await writeFile(OUT_MD, renderMd(report), "utf8");

  console.log(`\nWrote ${OUT_JSON}`);
  console.log(`Wrote ${OUT_MD}`);
  console.log(`\nSummary: ${pipelineCount} pipelines / ${stageCount} stages, ` +
    `${sectionCount(users)} users, ` +
    `${sectionCount(customFields.leads)}+${sectionCount(customFields.contacts)}+${sectionCount(customFields.companies)} custom fields (leads+contacts+companies), ` +
    `${sectionCount(tags.leads)}+${sectionCount(tags.contacts)}+${sectionCount(tags.companies)} tags, ` +
    `${sectionCount(bots)} salesbots, ${webhooks.available ? sectionCount(webhooks) + " webhooks" : "webhooks " + (webhooks as any).reason}.`);
  console.log("\nNothing was modified.");
}

function sectionCount(s: Section<unknown> | undefined): number {
  return s && s.available ? s.count : 0;
}

function renderMd(r: any): string {
  const L: string[] = [];
  L.push("# current-account.md", "");
  L.push(`> Snapshot read-only generado ${r._meta.generatedAt}. Nada fue modificado.`, "");
  const a = r.account ?? {};
  L.push("## Cuenta", "");
  L.push(`- Nombre: ${a.name}`);
  L.push(`- ID: ${a.id}`);
  L.push(`- Subdominio: ${a.subdomain}`);
  L.push(`- Moneda: ${a.currency ?? "?"} · País: ${a.country ?? "?"}`);
  L.push(`- Creada: ${a.created_at ? new Date(a.created_at * 1000).toISOString().slice(0, 10) : "?"}`);
  L.push("");

  L.push("## Pipelines y etapas", "");
  if (r.pipelines.available) {
    for (const p of r.pipelines.items as any[]) {
      L.push(`### ${p.name} (id ${p.id})${p.is_main ? " — principal" : ""}`);
      const st = p._embedded?.statuses ?? [];
      for (const s of st) L.push(`- ${s.id}: ${s.name} (type ${s.type})`);
      L.push("");
    }
  } else L.push(`_no disponible: ${r.pipelines.reason}_`, "");

  const tbl = (title: string, obj: any) => {
    L.push(`## ${title}`, "");
    for (const k of Object.keys(obj)) {
      const s = obj[k];
      L.push(`- ${k}: ${s.available ? s.count : "n/d (" + s.reason + ")"}`);
    }
    L.push("");
  };
  L.push(`## Usuarios: ${r.users.available ? r.users.count : "n/d"}`, "");
  if (r.users.available) for (const u of r.users.items as any[]) L.push(`- ${u.id}: ${u.name} <${u.email}>`);
  L.push("");
  tbl("Campos personalizados", r.customFields);
  tbl("Grupos de campos", r.fieldGroups);
  tbl("Etiquetas", r.tags);
  L.push(`## Motivos de pérdida: ${r.lossReasons.available ? r.lossReasons.count : "n/d"}`);
  L.push(`## Salesbots: ${r.bots.available ? r.bots.count : "n/d"}`);
  L.push(`## Webhooks: ${r.webhooks.available ? r.webhooks.count : "n/d (" + r.webhooks.reason + ")"}`);
  L.push(`## Task types: ${(r.taskTypes ?? []).length}`);
  for (const t of r.taskTypes ?? []) L.push(`- ${t.id}: ${t.name}`);
  L.push("");
  return L.join("\n");
}

main().catch((err) => {
  console.error("\nAudit FAILED:", (err as Error).message);
  process.exit(1);
});
