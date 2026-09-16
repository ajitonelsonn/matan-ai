/**
 * Single source of truth for Ring Partner API endpoints (server-side use only).
 * `RING_API_BASE_URL` may be overridden ONLY for automated tests against a local
 * emulator (e.g. ring-sandbox); it is never a NEXT_PUBLIC_ variable and never a token.
 */
export const RING_API_BASE_URL = process.env.RING_API_BASE_URL?.replace(/\/$/, "") || "https://api.amazonvision.com";
export const RING_PLAYGROUND_URL = "https://developer.amazon.com/ring/console/playground";
export const RING_DOCS_URL = "https://developer.amazon.com/docs/ring/api-documentation.html";

/** Playground tokens are valid for 30 minutes. */
export const RING_PLAYGROUND_TOKEN_LIFETIME_MS = 30 * 60 * 1000;
/** Warn the user when less than this remains. */
export const RING_TOKEN_EXPIRING_THRESHOLD_MS = 5 * 60 * 1000;

export const RING_DEVICES_INCLUDE = "status,capabilities,location,configurations";
export const RING_REQUEST_TIMEOUT_MS = 15_000;
export const RING_SESSION_COOKIE = "matan_ring_session";
