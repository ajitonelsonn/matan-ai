import type { JsonApiErrorDocument, RingErrorCode, RingErrorPayload } from "./types";

/**
 * Normalized Ring API error. Raw Ring responses never reach the UI;
 * the payload below is the only thing returned to the browser.
 */
export class RingApiError extends Error {
  code: RingErrorCode;
  httpStatus: number;
  retryAfterSeconds?: number;

  constructor(code: RingErrorCode, httpStatus: number, message?: string, retryAfterSeconds?: number) {
    super(message ?? copy[code].message);
    this.name = "RingApiError";
    this.code = code;
    this.httpStatus = httpStatus;
    this.retryAfterSeconds = retryAfterSeconds;
  }

  toPayload(): RingErrorPayload {
    return { code: this.code, title: copy[this.code].title, message: this.message, retryAfterSeconds: this.retryAfterSeconds };
  }
}

/** User-facing copy per error code (spec §23). */
export const copy: Record<RingErrorCode, { title: string; message: string }> = {
  RING_TOKEN_MISSING: { title: "Token required", message: "Paste a Ring Playground access token to continue." },
  RING_TOKEN_INVALID: { title: "Unable to connect", message: "The Ring Playground token is invalid or expired. Generate a new token in the Playground and try again." },
  RING_TOKEN_EXPIRED: { title: "Ring Playground session expired", message: "The Ring Playground token has expired. Generate a new token." },
  RING_FORBIDDEN: { title: "Access denied", message: "The token does not have permission to access these Ring resources." },
  RING_NOT_FOUND: { title: "Not found", message: "That Ring resource could not be found or is no longer accessible." },
  RING_RATE_LIMITED: { title: "Ring API rate limit reached", message: "Please wait a moment before trying again." },
  RING_UNAVAILABLE: { title: "Ring service temporarily unavailable", message: "Please try again shortly." },
  RING_BAD_REQUEST: { title: "Request rejected", message: "Ring rejected the request. Please try again." },
  RING_NETWORK: { title: "Couldn't reach Ring", message: "Matan AI couldn't reach the Ring API. Check your connection and try again." },
  RING_NO_SESSION: { title: "Not connected", message: "Connect Ring with a Playground token first." },
  RING_UNKNOWN: { title: "Something went wrong", message: "Ring returned an unexpected response. Please try again." },
};

/** Map an HTTP status (and optional JSON:API error body) to a normalized error. */
export function fromResponse(status: number, body: JsonApiErrorDocument | null, retryAfterHeader: string | null): RingApiError {
  const detail = body?.errors?.[0]?.detail;
  const retryAfter = retryAfterHeader ? Number.parseInt(retryAfterHeader, 10) : undefined;
  const retry = Number.isFinite(retryAfter) ? retryAfter : undefined;
  switch (status) {
    case 400:
      return new RingApiError("RING_BAD_REQUEST", 400);
    case 401:
      // Ring uses 401 for missing, invalid and expired tokens alike.
      return new RingApiError(/expired/i.test(detail ?? "") ? "RING_TOKEN_EXPIRED" : "RING_TOKEN_INVALID", 401);
    case 403:
      return new RingApiError("RING_FORBIDDEN", 403);
    case 404:
      return new RingApiError("RING_NOT_FOUND", 404);
    case 429:
      return new RingApiError("RING_RATE_LIMITED", 429, retry ? `Ring API rate limit reached. Try again in ${retry}s.` : undefined, retry);
    case 500:
    case 502:
    case 503:
    case 504:
      return new RingApiError("RING_UNAVAILABLE", 503);
    default:
      return new RingApiError("RING_UNKNOWN", status >= 400 ? status : 502);
  }
}

export function isRingApiError(e: unknown): e is RingApiError {
  return e instanceof RingApiError;
}
