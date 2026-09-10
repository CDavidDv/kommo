import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KommoClient } from "../src/kommo/client.js";
import { KommoApiError, KommoRateLimitError } from "../src/kommo/errors.js";

const silent = { debug: () => {}, warn: () => {}, error: () => {} };

function mkClient(overrides = {}) {
  return new KommoClient({
    subdomain: "acme",
    token: "a.b.c",
    minIntervalMs: 0,
    logger: silent,
    ...overrides,
  });
}

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(body === null ? "" : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

describe("KommoClient", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("sends Bearer auth and parses JSON", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { id: 1, name: "Acme" }));
    const out = await mkClient().get<{ id: number }>("/account");
    expect(out).toEqual({ id: 1, name: "Acme" });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://acme.kommo.com/api/v4/account");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer a.b.c");
  });

  it("builds query strings and drops undefined", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {}));
    await mkClient().get("/leads", { query: { limit: 5, page: undefined, with: "contacts" } });
    expect(fetchMock.mock.calls[0]![0]).toBe("https://acme.kommo.com/api/v4/leads?limit=5&with=contacts");
  });

  it("retries on 429 then succeeds (honours Retry-After)", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(429, { title: "rate" }, { "retry-after": "2" }))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));

    const p = mkClient().get<{ ok: boolean }>("/account");
    await vi.advanceTimersByTimeAsync(2000);
    expect(await p).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after max 429 retries with KommoRateLimitError", async () => {
    fetchMock.mockResolvedValue(jsonResponse(429, {}, { "retry-after": "1" }));
    const p = mkClient({ maxRateLimitRetries: 2 }).get("/account");
    const assertion = expect(p).rejects.toBeInstanceOf(KommoRateLimitError);
    await vi.advanceTimersByTimeAsync(10_000);
    await assertion;
  });

  it("treats 403 right after 429 as a suspected IP block", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(429, {}, { "retry-after": "1" }))
      .mockResolvedValueOnce(jsonResponse(403, { detail: "blocked" }));
    const p = mkClient().get("/account");
    const assertion = p.then(
      () => expect.unreachable(),
      (e) => {
        expect(e).toBeInstanceOf(KommoRateLimitError);
        expect((e as KommoRateLimitError).ipBlockSuspected).toBe(true);
      },
    );
    await vi.advanceTimersByTimeAsync(5000);
    await assertion;
  });

  it("maps 422 to KommoApiError with detail", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(422, { detail: "duplicate field" }));
    await mkClient()
      .post("/leads/custom_fields", [{ name: "x" }])
      .then(
        () => expect.unreachable(),
        (e) => {
          expect(e).toBeInstanceOf(KommoApiError);
          expect((e as KommoApiError).status).toBe(422);
          expect((e as Error).message).toMatch(/duplicate field/);
        },
      );
  });

  it("retries 5xx then throws after the cap", async () => {
    fetchMock.mockResolvedValue(jsonResponse(500, { title: "boom" }));
    const p = mkClient({ maxServerErrorRetries: 1 }).get("/account");
    const assertion = expect(p).rejects.toBeInstanceOf(KommoApiError);
    await vi.advanceTimersByTimeAsync(10_000);
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns null on 204", async () => {
    fetchMock.mockResolvedValueOnce({
      status: 204,
      ok: true,
      headers: new Headers(),
      text: async () => "",
    } as Response);
    expect(await mkClient().delete("/leads/1")).toBeNull();
  });

  it("never puts the token in an error message", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { title: "Unauthorized" }));
    const err: Error = await mkClient({ token: "SUPERSECRET.x.y" })
      .get("/account")
      .then(
        () => { throw new Error("expected rejection"); },
        (e) => e as Error,
      );
    expect(err.message).not.toContain("SUPERSECRET");
  });
});
