/**
 * Compile Salesbot templates → paste-ready Kommo scenario JSON.
 *   npm run bots:compile
 *
 * Templates live in config/bots/templates/*.json and use symbolic refs that this
 * script resolves against the LIVE account, so the output always carries the
 * right IDs (and migrating to another account is just: audit + recompile).
 *
 *   "@stage:<pipelineKey>/<stageKey>"  → that stage's numeric status_id
 *   "@field:<FIELD_CODE>"              → that lead custom field's numeric id
 *
 * Read-only against Kommo. Writes only local files under config/bots/kommo/.
 */
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { basename, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { loadConfig } from "../config/load.js";
import { kommoFromEnv } from "../kommo/index.js";
import { fetchLiveState } from "../monkits/plan.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const TPL_DIR = resolve(ROOT, "config/bots/templates");
const OUT_DIR = resolve(ROOT, "config/bots/kommo");

const norm = (s: string) => s.trim().toLowerCase();

async function main() {
  const config = await loadConfig();
  const kommo = kommoFromEnv();
  const live = await fetchLiveState(kommo);

  const stageId = (ref: string): number => {
    const [pk, sk] = ref.split("/");
    const pcfg = config.pipelines.find((p) => p.key === pk);
    if (!pcfg) throw new Error(`@stage: unknown pipeline key "${pk}"`);
    const scfg = pcfg.stages.find((s) => s.key === sk);
    if (!scfg) throw new Error(`@stage: unknown stage key "${pk}/${sk}"`);
    const lp = live.pipelines.find((p) => norm(p.name) === norm(pcfg.name));
    if (!lp) throw new Error(`@stage: pipeline "${pcfg.name}" not found live — run install first`);
    const ls = (lp._embedded?.statuses ?? []).find((x) => norm(x.name) === norm(scfg.name));
    if (!ls) throw new Error(`@stage: stage "${pcfg.name} › ${scfg.name}" not found live`);
    return ls.id;
  };

  const fieldId = (code: string): number => {
    const lf = live.fields.leads.find((x) => (x.code ?? "").toUpperCase() === code.toUpperCase());
    if (!lf) throw new Error(`@field: lead field "${code}" not found live — run install first`);
    return lf.id;
  };

  const resolveNode = (node: unknown, errs: string[]): unknown => {
    if (typeof node === "string") {
      try {
        if (node.startsWith("@stage:")) return stageId(node.slice(7));
        if (node.startsWith("@field:")) return fieldId(node.slice(7));
      } catch (e) {
        errs.push((e as Error).message);
        return node;
      }
      return node;
    }
    if (Array.isArray(node)) return node.map((n) => resolveNode(n, errs));
    if (node && typeof node === "object") {
      return Object.fromEntries(
        Object.entries(node as Record<string, unknown>).map(([k, v]) => [k, resolveNode(v, errs)]),
      );
    }
    return node;
  };

  await mkdir(OUT_DIR, { recursive: true });
  const files = (await readdir(TPL_DIR)).filter((f) => f.endsWith(".json"));
  let failed = 0;

  for (const f of files) {
    const raw = await readFile(resolve(TPL_DIR, f), "utf8");
    const tpl = JSON.parse(raw);
    const errs: string[] = [];
    const out = resolveNode(tpl, errs);
    const dest = resolve(OUT_DIR, basename(f));
    if (errs.length) {
      failed += 1;
      console.log(`✗ ${f}`);
      [...new Set(errs)].forEach((e) => console.log(`    ${e}`));
      continue;
    }
    await writeFile(dest, JSON.stringify(out, null, 2) + "\n", "utf8");
    const size = Buffer.byteLength(JSON.stringify(out));
    console.log(`✓ ${f}  →  config/bots/kommo/${f}  (${size} bytes${size > 65536 ? " — OVER 64KB!" : ""})`);
  }

  console.log(
    failed
      ? `\n${failed} template(s) could not be compiled. Run "npm run install:monkits -- --apply" first.`
      : `\nDone. Paste each config/bots/kommo/*.json into its Salesbot in Kommo (see docs/SALESBOT-SETUP.md).`,
  );
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error("bots:compile FAILED:", (err as Error).message);
  process.exit(1);
});
