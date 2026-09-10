/**
 * Idempotent Monkits installer.
 *   npm run install:monkits -- --dry-run     plan only, no changes (also the default)
 *   npm run install:monkits -- --apply       execute (asks for confirmation)
 *   npm run install:monkits -- --apply --yes  execute without prompt
 *
 * Never creates or modifies leads / contacts / companies data.
 * Salesbots and Digital Pipeline automations are printed as a MANUAL checklist.
 */
import { createInterface } from "node:readline/promises";
import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { loadKommoEnv, describeToken } from "../config/env.js";
import { loadConfig } from "../config/load.js";
import { kommoFromEnv } from "../kommo/index.js";
import { buildPlan, summarize, type Op } from "../monkits/plan.js";
import { applyConfig } from "../monkits/apply.js";

const CONFIG_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../../config");
const args = new Set(process.argv.slice(2));
const APPLY = args.has("--apply");
const YES = args.has("--yes");
const REGROUP_FIELDS = args.has("--regroup-fields");

const MARK: Record<Op, string> = { create: "+", update: "~", noop: "·", manual: "!" };

async function botChecklist() {
  const files = ["welcome", "public", "wholesale", "distributor", "franchise"];
  const lines: string[] = [];
  for (const f of files) {
    try {
      const b = JSON.parse(await readFile(resolve(CONFIG_DIR, "bots", `${f}.json`), "utf8"));
      lines.push(`  - "${b.name}" → ${b.attach_to.pipeline} › ${b.attach_to.stage}  (config/bots/${f}.json)`);
    } catch {
      /* ignore */
    }
  }
  return lines;
}

async function automationChecklist(): Promise<string[]> {
  try {
    const a = JSON.parse(await readFile(resolve(CONFIG_DIR, "automations.json"), "utf8"));
    return ((a.digital_pipeline ?? []) as any[]).map(
      (d) => `  - ${d.pipeline} › ${d.stage}: ${d.actions.join("; ")}`,
    );
  } catch {
    return [];
  }
}

async function main() {
  const env = loadKommoEnv();
  const meta = describeToken(env.token);
  console.log(`Monkits installer — ${env.subdomain}.kommo.com`);
  console.log(APPLY ? "MODE: APPLY (will modify the account)\n" : "MODE: DRY RUN (no changes)\n");
  if (meta?.expired) {
    console.error("Token is EXPIRED. Regenerate the long-lived token first.");
    process.exit(1);
  }

  const config = await loadConfig();
  const kommo = kommoFromEnv();
  const plan = await buildPlan(kommo, config);
  const s = summarize(plan);

  const groups = ["pipeline", "stage", "field-group", "field", "tag"];
  for (const g of groups) {
    const items = plan.actions.filter((a) => a.kind === g && a.op !== "noop");
    if (!items.length) continue;
    console.log(`${g.toUpperCase()}`);
    for (const a of items) {
      console.log(`  ${MARK[a.op]} ${a.label}${a.detail ? `  — ${a.detail}` : ""}${a.risky ? "   ⚠" : ""}`);
    }
    console.log("");
  }

  const noopCount = plan.actions.filter((a) => a.op === "noop").length;

  console.log("─".repeat(60));
  console.log("PLAN");
  console.log(`  create : ${s.create}  (${s.pipelines} pipelines, ${s.stagesCreate} stages, ${s.groups} groups, ${s.fields} fields, ${s.tags} tags)`);
  console.log(`  modify : ${s.update}  (${s.stagesRename} stage renames + pipeline settings)  ⚠ ${s.risky} risky`);
  console.log(`  already ok / skipped : ${noopCount}`);
  console.log(`  leads / contacts / companies data touched : 0`);
  console.log("─".repeat(60));

  console.log("\nMANUAL (no API) — after apply, do these in Kommo:");
  console.log(" Salesbots  (Settings › Communication tools › Salesbots, paste JSON from config/bots/):");
  (await botChecklist()).forEach((l) => console.log(l));
  console.log(" Digital Pipeline  (Leads › Automate):");
  (await automationChecklist()).forEach((l) => console.log(l));
  console.log(" Channels: connect WhatsApp / Facebook / Instagram / TikTok, point new leads to 'P0 · Recepción & Triaje'.");

  if (!APPLY) {
    console.log("\nDry run only. Re-run with --apply to execute.");
    return;
  }

  const risky = plan.actions.filter((a) => a.risky);
  if (risky.length) {
    console.log(`\n⚠ ${risky.length} risky change(s) — these modify existing resources:`);
    risky.forEach((a) => console.log(`   ~ ${a.label} — ${a.detail}`));
  }

  if (!YES) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const ans = (await rl.question(`\nProceed with ${s.create} creations + ${s.update} modifications? [y/N] `)).trim().toLowerCase();
    rl.close();
    if (ans !== "y" && ans !== "yes") {
      console.log("Aborted. Nothing changed.");
      process.exit(0);
    }
  }

  console.log("\nApplying...");
  if (REGROUP_FIELDS) console.log("(--regroup-fields: empty ungrouped fields will be deleted + recreated in their group)\n");
  const result = await applyConfig(kommo, config, console.log, { regroupFields: REGROUP_FIELDS });
  console.log("\n─".repeat(30));
  console.log(`Created: ${result.created.length}  Updated: ${result.updated.length}  Skipped: ${result.skipped.length}  Failed: ${result.failed.length}`);
  if (result.failed.length) {
    console.log("\nFailed:");
    result.failed.forEach((f) => console.log(`  ✗ ${f.what} — ${f.reason}`));
    process.exit(1);
  }
  console.log("\nDone. Now do the MANUAL steps above.");
}

main().catch((err) => {
  console.error("\nInstaller FAILED:", (err as Error).message);
  process.exit(1);
});
