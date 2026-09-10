import { KommoClient, collectAll } from "../kommo/index.js";
import { ENTITIES, type Entity, type MonkitsConfig, type PipelineCfg } from "../config/load.js";

export type Op = "create" | "update" | "noop" | "manual";

export interface Action {
  op: Op;
  kind: string;
  label: string;
  detail?: string;
  risky?: boolean;
}

export interface Plan {
  actions: Action[];
  live: LiveState;
}

interface LiveStatus {
  id: number;
  name: string;
  sort: number;
  type: number;
  is_editable?: boolean;
}
interface LivePipeline {
  id: number;
  name: string;
  is_main: boolean;
  is_unsorted_on: boolean;
  _embedded?: { statuses?: LiveStatus[] };
}
interface LiveField {
  id: number;
  name: string;
  type: string;
  code?: string;
  enums?: Array<{ id: number; value: string }>;
}
interface LiveGroup {
  id: number | string;
  name: string;
}
interface LiveTag {
  id: number;
  name: string;
  color?: string;
}

export interface LiveState {
  pipelines: LivePipeline[];
  fields: Record<Entity, LiveField[]>;
  groups: Record<Entity, LiveGroup[]>;
  tags: Record<Entity, LiveTag[]>;
}

const norm = (s: string) => s.trim().toLowerCase();

export async function fetchLiveState(client: KommoClient): Promise<LiveState> {
  const pipelines = await collectAll<LivePipeline>(client, "/leads/pipelines", "pipelines");
  const fields = {} as Record<Entity, LiveField[]>;
  const groups = {} as Record<Entity, LiveGroup[]>;
  const tags = {} as Record<Entity, LiveTag[]>;
  for (const e of ENTITIES) {
    fields[e] = await collectAll<LiveField>(client, `/${e}/custom_fields`, "custom_fields");
    groups[e] = await collectAll<LiveGroup>(client, `/${e}/custom_fields/groups`, "custom_field_groups");
    tags[e] = await collectAll<LiveTag>(client, `/${e}/tags`, "tags");
  }
  return { pipelines, fields, groups, tags };
}

function planPipeline(cfg: PipelineCfg, live: LiveState, actions: Action[]) {
  let livePipe: LivePipeline | undefined;
  if (cfg.reuse) {
    livePipe = live.pipelines.find((p) => p.id === cfg.reuse!.pipeline_id);
    if (!livePipe) {
      actions.push({
        op: "manual",
        kind: "pipeline",
        label: cfg.name,
        detail: `reuse pipeline_id ${cfg.reuse.pipeline_id} not found — check config`,
        risky: true,
      });
      return;
    }
  } else {
    livePipe = live.pipelines.find((p) => norm(p.name) === norm(cfg.name));
  }

  if (!livePipe) {
    const newStages = cfg.stages.filter((s) => !s.system);
    actions.push({
      op: "create",
      kind: "pipeline",
      label: cfg.name,
      detail: `+ ${newStages.length} stages (142/143 auto-created, then renamed)`,
    });
    for (const s of cfg.stages) {
      actions.push({
        op: s.system ? "update" : "create",
        kind: "stage",
        label: `${cfg.name} › ${s.name}`,
        detail: s.system ? `rename system stage ${s.system}` : `sort ${s.sort}`,
        risky: !!s.system,
      });
    }
    return;
  }

  // pipeline exists
  const liveStatuses = livePipe._embedded?.statuses ?? [];
  if (norm(livePipe.name) !== norm(cfg.name)) {
    actions.push({
      op: "update",
      kind: "pipeline",
      label: cfg.name,
      detail: `rename from "${livePipe.name}"`,
      risky: true,
    });
  }
  if (cfg.is_main !== undefined && livePipe.is_main !== cfg.is_main) {
    actions.push({
      op: "update",
      kind: "pipeline",
      label: cfg.name,
      detail: `set is_main = ${cfg.is_main} (was ${livePipe.is_main})`,
      risky: true,
    });
  }
  if (cfg.is_unsorted_on !== undefined && livePipe.is_unsorted_on !== cfg.is_unsorted_on) {
    actions.push({
      op: "update",
      kind: "pipeline",
      label: cfg.name,
      detail: `set is_unsorted_on = ${cfg.is_unsorted_on} (was ${livePipe.is_unsorted_on})`,
      risky: true,
    });
  }

  for (const s of cfg.stages) {
    let ls: LiveStatus | undefined;
    if (s.system) ls = liveStatuses.find((x) => x.id === s.system);
    else if (s.reuse_status_id) ls = liveStatuses.find((x) => x.id === s.reuse_status_id);
    else ls = liveStatuses.find((x) => norm(x.name) === norm(s.name));

    if (!ls) {
      actions.push({
        op: "create",
        kind: "stage",
        label: `${cfg.name} › ${s.name}`,
        detail: `sort ${s.sort ?? "?"}`,
      });
      continue;
    }
    if (norm(ls.name) !== norm(s.name)) {
      const locked = ls.is_editable === false;
      actions.push({
        op: "update",
        kind: "stage",
        label: `${cfg.name} › ${s.name}`,
        detail: `rename from "${ls.name}" (id ${ls.id})${locked ? " — is_editable=false, Kommo may reject" : ""}`,
        risky: locked,
      });
    } else {
      actions.push({ op: "noop", kind: "stage", label: `${cfg.name} › ${s.name}`, detail: "already correct" });
    }
  }
}

export async function buildPlan(client: KommoClient, config: MonkitsConfig): Promise<Plan> {
  const live = await fetchLiveState(client);
  const actions: Action[] = [];

  for (const p of config.pipelines) planPipeline(p, live, actions);

  for (const e of ENTITIES) {
    for (const g of config.groups[e] ?? []) {
      const exists = live.groups[e].some((x) => norm(x.name) === norm(g.name));
      actions.push(
        exists
          ? { op: "noop", kind: "field-group", label: `${e}: ${g.name}`, detail: "exists" }
          : { op: "create", kind: "field-group", label: `${e}: ${g.name}` },
      );
    }
    for (const f of config.fields[e] ?? []) {
      const byCode = f.code && live.fields[e].find((x) => (x.code ?? "").toUpperCase() === f.code.toUpperCase());
      const byName = live.fields[e].find((x) => norm(x.name) === norm(f.name));
      const liveF = byCode || byName;
      if (liveF) {
        const missingEnums =
          f.enums?.filter((v) => !(liveF.enums ?? []).some((le) => norm(le.value) === norm(v))) ?? [];
        actions.push({
          op: "noop",
          kind: "field",
          label: `${e}: ${f.name}`,
          detail: `exists (id ${liveF.id})${missingEnums.length ? ` — missing enums: ${missingEnums.join(", ")}` : ""}`,
        });
      } else if (!f.enabled) {
        actions.push({ op: "noop", kind: "field", label: `${e}: ${f.name}`, detail: "disabled in config — skipped" });
      } else {
        actions.push({
          op: "create",
          kind: "field",
          label: `${e}: ${f.name}`,
          detail: `${f.type}${f.enums ? ` [${f.enums.length} opts]` : ""}${f.group ? ` · group ${f.group}` : ""}`,
        });
      }
    }
    for (const t of config.tags[e] ?? []) {
      const exists = live.tags[e].some((x) => norm(x.name) === norm(t.name));
      actions.push(
        exists
          ? { op: "noop", kind: "tag", label: `${e}: ${t.name}`, detail: "exists" }
          : { op: "create", kind: "tag", label: `${e}: ${t.name}` },
      );
    }
  }

  return { actions, live };
}

export function summarize(plan: Plan) {
  const by = (op: Op, kind?: string) =>
    plan.actions.filter((a) => a.op === op && (!kind || a.kind === kind)).length;
  return {
    create: by("create"),
    update: by("update"),
    noop: by("noop"),
    risky: plan.actions.filter((a) => a.risky).length,
    pipelines: by("create", "pipeline"),
    stagesCreate: by("create", "stage"),
    stagesRename: plan.actions.filter((a) => a.op === "update" && a.kind === "stage").length,
    fields: by("create", "field"),
    groups: by("create", "field-group"),
    tags: by("create", "tag"),
  };
}
