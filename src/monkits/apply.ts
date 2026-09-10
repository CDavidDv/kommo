import { KommoClient } from "../kommo/index.js";
import { ENTITIES, type MonkitsConfig } from "../config/load.js";
import { fetchLiveState } from "./plan.js";

const norm = (s: string) => s.trim().toLowerCase();

export interface ApplyResult {
  created: string[];
  updated: string[];
  skipped: string[];
  failed: Array<{ what: string; reason: string }>;
}

type Logger = (line: string) => void;

/**
 * Executes the config against Kommo. Creates missing resources, renames reused ones.
 * NEVER touches leads/contacts/companies data. Idempotent: safe to re-run.
 */
export interface ApplyOptions {
  /** Recreate an existing (empty) field when its group or enum list drifted from config. */
  refreshFields?: boolean;
}

export async function applyConfig(
  client: KommoClient,
  config: MonkitsConfig,
  log: Logger = console.log,
  opts: ApplyOptions = {},
): Promise<ApplyResult> {
  const res: ApplyResult = { created: [], updated: [], skipped: [], failed: [] };
  const live = await fetchLiveState(client);
  const pipelineId = new Map<string, number>();
  const groupId = new Map<string, number | string>();

  const step = async (what: string, fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (e) {
      res.failed.push({ what, reason: (e as Error).message });
      log(`  ✗ ${what}: ${(e as Error).message}`);
    }
  };

  // ---- Pipelines + stages ----
  for (const p of config.pipelines) {
    let livePipe =
      (p.reuse && live.pipelines.find((x) => x.id === p.reuse!.pipeline_id)) ||
      live.pipelines.find((x) => norm(x.name) === norm(p.name));

    if (!livePipe) {
      await step(`create pipeline "${p.name}"`, async () => {
        const statuses = p.stages
          .filter((s) => !s.system)
          .map((s) => ({ name: s.name, sort: s.sort, color: s.color }));
        const body = [
          {
            name: p.name,
            sort: p.sort,
            is_main: p.is_main ?? false,
            is_unsorted_on: p.is_unsorted_on ?? false,
            _embedded: { statuses },
          },
        ];
        const r = await client.post<any>("/leads/pipelines", body);
        const created = r?._embedded?.pipelines?.[0];
        if (!created?.id) throw new Error("no pipeline id in response");
        pipelineId.set(p.key, created.id);
        livePipe = created;
        res.created.push(`pipeline ${p.name} (id ${created.id})`);
        log(`  + pipeline ${p.name} (id ${created.id}) + ${statuses.length} stages`);
      });
      // rename system stages 142/143 on the fresh pipeline
      const pid = pipelineId.get(p.key);
      if (pid) {
        for (const s of p.stages.filter((x) => x.system)) {
          await step(`rename stage ${s.system} → "${s.name}"`, async () => {
            await client.patch(`/leads/pipelines/${pid}/statuses/${s.system}`, { name: s.name });
            res.updated.push(`stage ${p.name} › ${s.name}`);
            log(`  ~ stage ${p.name} › ${s.name}`);
          });
        }
      }
      continue;
    }

    pipelineId.set(p.key, livePipe.id);
    const pid = livePipe.id;
    const liveStatuses = livePipe._embedded?.statuses ?? [];

    const patch: Record<string, unknown> = {};
    if (norm(livePipe.name) !== norm(p.name)) patch.name = p.name;
    if (p.is_main !== undefined && livePipe.is_main !== p.is_main) patch.is_main = p.is_main;
    if (p.is_unsorted_on !== undefined && livePipe.is_unsorted_on !== p.is_unsorted_on)
      patch.is_unsorted_on = p.is_unsorted_on;
    if (Object.keys(patch).length) {
      await step(`update pipeline "${p.name}" (${Object.keys(patch).join(", ")})`, async () => {
        await client.patch(`/leads/pipelines/${pid}`, patch);
        res.updated.push(`pipeline ${p.name} (${Object.keys(patch).join(", ")})`);
        log(`  ~ pipeline ${p.name} (${Object.keys(patch).join(", ")})`);
      });
    }

    for (const s of p.stages) {
      // System won/lost stages (142/143) cannot be renamed via API — Kommo rejects
      // the PATCH with 400. Their names must be changed in the Kommo UI.
      if (s.system) {
        res.skipped.push(`stage ${p.name} › ${s.name} (system ${s.system} — rename in UI)`);
        continue;
      }

      const ls =
        (s.reuse_status_id && liveStatuses.find((x) => x.id === s.reuse_status_id)) ||
        liveStatuses.find((x) => norm(x.name) === norm(s.name));

      if (!ls) {
        await step(`create stage "${p.name} › ${s.name}"`, async () => {
          await client.post(`/leads/pipelines/${pid}/statuses`, [
            { name: s.name, sort: s.sort, color: s.color },
          ]);
          res.created.push(`stage ${p.name} › ${s.name}`);
          log(`  + stage ${p.name} › ${s.name}`);
        });
        continue;
      }

      // Kommo's stage PATCH is a full replace, not a partial update: sending only
      // `name` wipes `sort`, sending only `sort` wipes `name`. Always send all three.
      const liveColor = (ls as { color?: string }).color;
      const liveSort = (ls as { sort?: number }).sort;
      const wantColor = s.color ?? liveColor;
      const needs =
        norm(ls.name) !== norm(s.name) ||
        (s.sort !== undefined && liveSort !== s.sort) ||
        (s.color !== undefined && liveColor !== s.color);
      if (needs) {
        const body: Record<string, unknown> = { name: s.name };
        if (s.sort !== undefined) body.sort = s.sort;
        if (wantColor) body.color = wantColor;
        await step(`update stage "${ls.name}" → "${s.name}"`, async () => {
          await client.patch(`/leads/pipelines/${pid}/statuses/${ls.id}`, body);
          res.updated.push(`stage ${p.name} › ${s.name}`);
          log(`  ~ stage ${p.name} › ${s.name} (name+sort+color)`);
        });
      } else {
        res.skipped.push(`stage ${p.name} › ${s.name}`);
      }
    }
  }

  // ---- Field groups ----
  for (const e of ENTITIES) {
    for (const g of config.groups[e] ?? []) {
      const existing = live.groups[e].find((x) => norm(x.name) === norm(g.name));
      if (existing) {
        groupId.set(`${e}:${g.key}`, existing.id);
        res.skipped.push(`field-group ${e}: ${g.name}`);
        continue;
      }
      await step(`create field-group ${e}: ${g.name}`, async () => {
        const r = await client.post<any>(`/${e}/custom_fields/groups`, [{ name: g.name, sort: g.sort }]);
        const id = r?._embedded?.custom_field_groups?.[0]?.id ?? r?._embedded?.["custom_field_groups"]?.[0]?.id ?? r?.id;
        if (id !== undefined) groupId.set(`${e}:${g.key}`, id);
        res.created.push(`field-group ${e}: ${g.name}`);
        log(`  + field-group ${e}: ${g.name} (id ${id})`);
      });
    }
  }

  // ---- Custom fields ----
  for (const e of ENTITIES) {
    for (const f of config.fields[e] ?? []) {
      const exists =
        (f.code && live.fields[e].find((x) => (x.code ?? "").toUpperCase() === f.code.toUpperCase())) ||
        live.fields[e].find((x) => norm(x.name) === norm(f.name));
      if (exists) {
        const gid = f.group ? groupId.get(`${e}:${f.group}`) : undefined;
        const currentGid = (exists as { group_id?: unknown }).group_id;
        const wrongGroup = gid !== undefined && String(currentGid ?? "") !== String(gid);
        const liveEnums = ((exists as { enums?: Array<{ value: string }> }).enums ?? []).map((x) =>
          norm(x.value),
        );
        const enumDrift =
          !!f.enums?.length &&
          (f.enums.length !== liveEnums.length ||
            f.enums.some((v) => !liveEnums.includes(norm(v))));
        const drifted = wrongGroup || enumDrift;
        if (drifted && opts.refreshFields && f.enabled) {
          // Kommo rejects PATCH for both group_id and enum changes on an existing
          // field. Only reliable path: delete the (empty) field, recreate it.
          // Safe while the account has no leads.
          const why = [wrongGroup && "group", enumDrift && "enums"].filter(Boolean).join("+");
          await step(`refresh field ${e}: ${f.name} (${why}, delete + recreate)`, async () => {
            await client.delete(`/${e}/custom_fields/${exists.id}`);
            const body: Record<string, unknown> = { type: f.type, name: f.name, code: f.code };
            if (gid !== undefined) body.group_id = gid;
            if (f.enums?.length) body.enums = f.enums.map((v, i) => ({ value: v, sort: (i + 1) * 10 }));
            await client.post(`/${e}/custom_fields`, [body]);
            res.updated.push(`field ${e}: ${f.name} (refreshed: ${why})`);
            log(`  ~ field ${e}: ${f.name} → recreated (${why})`);
          });
        } else if (drifted) {
          const why = [wrongGroup && "group", enumDrift && "enums"].filter(Boolean).join("+");
          res.skipped.push(`field ${e}: ${f.name} (${why} pending — run with --refresh-fields)`);
        } else {
          res.skipped.push(`field ${e}: ${f.name}`);
        }
        continue;
      }
      if (!f.enabled) {
        res.skipped.push(`field ${e}: ${f.name} (disabled)`);
        continue;
      }
      await step(`create field ${e}: ${f.name}`, async () => {
        const gid = f.group ? groupId.get(`${e}:${f.group}`) : undefined;
        const body: Record<string, unknown> = { type: f.type, name: f.name, code: f.code };
        if (gid !== undefined) body.group_id = gid;
        if (f.enums?.length)
          body.enums = f.enums.map((v, i) => ({ value: v, sort: (i + 1) * 10 }));
        await client.post(`/${e}/custom_fields`, [body]);
        res.created.push(`field ${e}: ${f.name}`);
        log(`  + field ${e}: ${f.name}`);
      });
    }
  }

  // ---- Tags ----
  for (const e of ENTITIES) {
    const missing = (config.tags[e] ?? []).filter(
      (t) => !live.tags[e].some((x) => norm(x.name) === norm(t.name)),
    );
    if (!missing.length) continue;
    await step(`create ${missing.length} ${e} tags`, async () => {
      await client.post(
        `/${e}/tags`,
        missing.map((t) => ({ name: t.name, color: t.color })),
      );
      for (const t of missing) {
        res.created.push(`tag ${e}: ${t.name}`);
        log(`  + tag ${e}: ${t.name}`);
      }
    });
  }

  return res;
}
