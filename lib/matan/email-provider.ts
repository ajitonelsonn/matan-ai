/** Pure provider-selection rules (no server-only imports - unit-testable). */
export type EmailProvider = "ses" | "smtp";

export interface SendResult {
  provider: EmailProvider;
  messageId: string;
}

/** SES failures that a different provider can plausibly overcome (Sandbox limits, IAM, config, transient). */
const SES_FALLBACK_CODES = new Set(["SES_MESSAGE_REJECTED", "SES_ACCESS_DENIED", "SES_CONFIGURATION_ERROR", "SES_THROTTLED", "SES_NETWORK", "SES_ERROR"]);

/**
 * Given the provider that just failed and its error code, return the next provider to try
 * (in `order`, only if configured) or null when the chain should stop.
 */
export function chooseFallback(failed: EmailProvider, code: string, order: EmailProvider[], configured: Record<EmailProvider, boolean>): EmailProvider | null {
  if (failed === "ses" && !SES_FALLBACK_CODES.has(code)) return null;
  const idx = order.indexOf(failed);
  for (const candidate of order.slice(idx + 1)) if (configured[candidate]) return candidate;
  return null;
}
