import { afterEach, describe, expect, it, vi } from "vitest";
import { describeToken, loadKommoEnv } from "../src/config/env.js";

const FAKE_JWT = [
  "h",
  Buffer.from(JSON.stringify({ account_id: 123, exp: 4102444800, scopes: ["crm"] })).toString("base64url"),
  "s",
].join(".");

describe("loadKommoEnv", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("normalizes a full URL subdomain", () => {
    vi.stubEnv("KOMMO_SUBDOMAIN", "https://acme.kommo.com/");
    vi.stubEnv("KOMMO_LONG_LIVED_TOKEN", FAKE_JWT);
    expect(loadKommoEnv().subdomain).toBe("acme");
  });

  it("throws on missing token", () => {
    vi.stubEnv("KOMMO_SUBDOMAIN", "acme");
    vi.stubEnv("KOMMO_LONG_LIVED_TOKEN", "");
    expect(() => loadKommoEnv()).toThrow(/KOMMO_LONG_LIVED_TOKEN/);
  });

  it("throws on non-JWT token", () => {
    vi.stubEnv("KOMMO_SUBDOMAIN", "acme");
    vi.stubEnv("KOMMO_LONG_LIVED_TOKEN", "not-a-jwt");
    expect(() => loadKommoEnv()).toThrow(/JWT/);
  });
});

describe("describeToken", () => {
  it("decodes non-secret payload metadata", () => {
    const d = describeToken(FAKE_JWT);
    expect(d?.accountId).toBe(123);
    expect(d?.scopes).toEqual(["crm"]);
    expect(d?.expired).toBe(false);
  });

  it("returns null on garbage", () => {
    expect(describeToken("x.y")).toBeNull();
  });
});
