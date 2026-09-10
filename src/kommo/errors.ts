/** Base error for all Kommo client failures. Never carries auth headers. */
export class KommoError extends Error {}

export class KommoApiError extends KommoError {
  constructor(
    readonly status: number,
    readonly method: string,
    readonly path: string,
    readonly body: unknown,
  ) {
    super(`Kommo API ${status} on ${method} ${path}${KommoApiError.hint(status, body)}`);
    this.name = "KommoApiError";
  }

  private static hint(status: number, body: unknown): string {
    const detail =
      body && typeof body === "object"
        ? ((body as Record<string, unknown>)["detail"] ??
          (body as Record<string, unknown>)["title"] ??
          (body as Record<string, unknown>)["message"])
        : undefined;
    const known: Record<number, string> = {
      400: "invalid request data",
      401: "token invalid or expired",
      403: "insufficient permissions or plan (or IP temporarily blocked)",
      404: "resource not found",
      422: "unprocessable — check field values / duplicates",
      429: "rate limit exceeded",
    };
    const parts = [known[status], detail ? String(detail) : undefined].filter(Boolean);
    return parts.length ? ` — ${parts.join(": ")}` : "";
  }
}

/** Thrown when retries are exhausted on 429, or a 403 follows a 429 (likely IP block). */
export class KommoRateLimitError extends KommoError {
  constructor(readonly method: string, readonly path: string, readonly ipBlockSuspected: boolean) {
    super(
      ipBlockSuspected
        ? `Kommo returned 403 right after 429 on ${method} ${path} — IP block suspected. Stop and wait before retrying.`
        : `Kommo rate limit (429) not cleared after retries on ${method} ${path}.`,
    );
    this.name = "KommoRateLimitError";
  }
}
