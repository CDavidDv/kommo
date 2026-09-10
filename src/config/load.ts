import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CONFIG_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../../config");

export const ALLOWED_STAGE_COLORS = new Set([
  "#fffeb2", "#fffd7f", "#fff000", "#ffeab2", "#ffdc7f", "#ffce5a", "#ffdbdb", "#ffc8c8",
  "#ff8f92", "#d6eaff", "#c1e0ff", "#98cbff", "#ebffb1", "#deff81", "#87f2c0", "#f9deff",
  "#f3beff", "#ccc8f9", "#eb93ff", "#f2f3f4", "#e6e8ea",
]);

export const ALLOWED_TAG_COLORS = new Set([
  "EBEBEB", "D0D0D0", "F2DDF7", "D1A4DC", "FF8F92", "FFC8C8", "C7DB8C", "DDEBB5", "8699DA",
  "AABDFF", "FFCE5A", "FFE193", "90CDB0", "C6F4DE", "A9A5D7", "D8D5FF", "86C0FC", "832161",
  "6A0F49", "0C7C59", "10599D", "9D2B32", "247BA0",
]);

export const FIELD_TYPES = new Set([
  "text", "numeric", "select", "multiselect", "date", "url", "textarea", "checkbox",
  "radiobutton", "streetaddress", "smart_address", "birthday", "legal_entity", "date_time",
  "price", "monetary",
]);

export const ENTITIES = ["leads", "contacts", "companies"] as const;
export type Entity = (typeof ENTITIES)[number];

export interface StageCfg {
  key: string;
  name: string;
  sort?: number;
  color?: string;
  system?: 142 | 143;
  reuse_status_id?: number;
}
export interface PipelineCfg {
  key: string;
  name: string;
  is_main?: boolean;
  is_unsorted_on?: boolean;
  sort?: number;
  reuse?: { pipeline_id: number };
  stages: StageCfg[];
}
export interface FieldCfg {
  code: string;
  name: string;
  type: string;
  group?: string;
  enabled: boolean;
  enums?: string[];
}
export interface GroupCfg {
  key: string;
  name: string;
  sort?: number;
}
export interface TagCfg {
  name: string;
  color?: string;
}

export interface MonkitsConfig {
  pipelines: PipelineCfg[];
  groups: Partial<Record<Entity, GroupCfg[]>>;
  fields: Partial<Record<Entity, FieldCfg[]>>;
  tags: Partial<Record<Entity, TagCfg[]>>;
}

class ConfigError extends Error {}

async function readJson(name: string): Promise<any> {
  const raw = await readFile(resolve(CONFIG_DIR, name), "utf8");
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new ConfigError(`config/${name} is not valid JSON: ${(e as Error).message}`);
  }
}

export async function loadConfig(): Promise<MonkitsConfig> {
  const [pipelinesRaw, fieldsRaw, tagsRaw] = await Promise.all([
    readJson("pipelines.json"),
    readJson("fields.json"),
    readJson("tags.json"),
  ]);

  const errors: string[] = [];
  const pipelines: PipelineCfg[] = pipelinesRaw.pipelines ?? [];
  const seenPk = new Set<string>();

  for (const p of pipelines) {
    if (!p.key || !p.name) errors.push(`pipeline missing key/name: ${JSON.stringify(p)}`);
    if (seenPk.has(p.key)) errors.push(`duplicate pipeline key: ${p.key}`);
    seenPk.add(p.key);

    const sys = p.stages.filter((s) => s.system).map((s) => s.system);
    if (!sys.includes(142)) errors.push(`pipeline "${p.key}" has no system:142 stage`);
    if (!sys.includes(143)) errors.push(`pipeline "${p.key}" has no system:143 stage`);

    const seenSk = new Set<string>();
    for (const s of p.stages) {
      if (seenSk.has(s.key)) errors.push(`pipeline "${p.key}" duplicate stage key: ${s.key}`);
      seenSk.add(s.key);
      if (!s.system && !s.reuse_status_id) {
        if (typeof s.sort !== "number") errors.push(`stage "${p.key}/${s.key}" needs sort`);
        if (s.color && !ALLOWED_STAGE_COLORS.has(s.color))
          errors.push(`stage "${p.key}/${s.key}" color ${s.color} not in allowed palette`);
      }
    }
  }

  const groups: MonkitsConfig["groups"] = {};
  const fields: MonkitsConfig["fields"] = {};
  for (const e of ENTITIES) {
    const gs: GroupCfg[] = fieldsRaw.groups?.[e] ?? [];
    const fs: FieldCfg[] = fieldsRaw.fields?.[e] ?? [];
    if (gs.length) groups[e] = gs;
    if (fs.length) fields[e] = fs;
    const seenCode = new Set<string>();
    const groupKeys = new Set(gs.map((g) => g.key));
    for (const f of fs) {
      const code = f.code?.toUpperCase();
      if (!code || !f.name) errors.push(`${e} field missing code/name`);
      if (code && seenCode.has(code)) errors.push(`${e} duplicate field code: ${code}`);
      if (code) seenCode.add(code);
      if (!FIELD_TYPES.has(f.type)) errors.push(`${e} field ${code}: unknown type "${f.type}"`);
      if (["select", "multiselect", "radiobutton"].includes(f.type) && !(f.enums?.length))
        errors.push(`${e} field ${code}: type ${f.type} needs enums`);
      if (f.group && !groupKeys.has(f.group))
        errors.push(`${e} field ${code}: group "${f.group}" not defined`);
    }
  }

  const tags: MonkitsConfig["tags"] = {};
  for (const e of ENTITIES) {
    const ts: TagCfg[] = tagsRaw.tags?.[e] ?? [];
    if (ts.length) tags[e] = ts;
    for (const t of ts) {
      if (!t.name) errors.push(`${e} tag missing name`);
      if (t.color && !ALLOWED_TAG_COLORS.has(t.color))
        errors.push(`${e} tag "${t.name}" color ${t.color} not in allowed palette`);
    }
  }

  if (errors.length) throw new ConfigError("Invalid config:\n  - " + errors.join("\n  - "));

  return { pipelines, groups, fields, tags };
}
