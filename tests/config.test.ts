import { describe, expect, it } from "vitest";
import { loadConfig, ALLOWED_STAGE_COLORS, ALLOWED_TAG_COLORS } from "../src/config/load.js";

describe("config/*.json", () => {
  it("loads and validates", async () => {
    const c = await loadConfig();
    expect(c.pipelines).toHaveLength(5);
  });

  it("every pipeline has system 142 and 143", async () => {
    const c = await loadConfig();
    for (const p of c.pipelines) {
      const sys = p.stages.filter((s) => s.system).map((s) => s.system);
      expect(sys).toContain(142);
      expect(sys).toContain(143);
    }
  });

  it("reused Público points at the audited pipeline id", async () => {
    const c = await loadConfig();
    const pub = c.pipelines.find((p) => p.key === "publico");
    expect(pub?.reuse?.pipeline_id).toBe(14436983);
  });

  it("new-pipeline stage colors are in the allowed palette", async () => {
    const c = await loadConfig();
    for (const p of c.pipelines) {
      for (const s of p.stages) {
        if (s.color) expect(ALLOWED_STAGE_COLORS.has(s.color)).toBe(true);
      }
    }
  });

  it("tag colors are in the allowed palette", async () => {
    const c = await loadConfig();
    for (const t of c.tags.leads ?? []) {
      if (t.color) expect(ALLOWED_TAG_COLORS.has(t.color)).toBe(true);
    }
  });

  it("enabled select fields carry enums", async () => {
    const c = await loadConfig();
    for (const f of c.fields.leads ?? []) {
      if (["select", "multiselect"].includes(f.type)) expect(f.enums?.length).toBeGreaterThan(0);
    }
  });
});
