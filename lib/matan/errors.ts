export type MatanAiErrorCode =
  | "MATAN_AI_CONFIGURATION_ERROR"
  | "MATAN_AI_ACCESS_DENIED"
  | "MATAN_AI_THROTTLED"
  | "MATAN_AI_TIMEOUT"
  | "MATAN_AI_INVALID_RESPONSE"
  | "MATAN_AI_UNAVAILABLE"
  | "MATAN_AI_EVENT_NOT_FOUND"
  | "MATAN_AI_BAD_REQUEST"
  | "MATAN_AI_BUDGET_EXCEEDED";

export const matanAiCopy: Record<MatanAiErrorCode, { title: string; message: string; http: number }> = {
  MATAN_AI_CONFIGURATION_ERROR: { title: "AI not configured", message: "Amazon Bedrock credentials or model are not configured on the server.", http: 500 },
  MATAN_AI_ACCESS_DENIED: { title: "AI access denied", message: "The server identity is not allowed to invoke the Bedrock model. Check IAM (bedrock:InvokeModel) and model access.", http: 403 },
  MATAN_AI_THROTTLED: { title: "AI is busy", message: "Amazon Bedrock is throttling requests. Try again in a moment.", http: 429 },
  MATAN_AI_TIMEOUT: { title: "AI timed out", message: "Matan AI didn't get an answer from Bedrock in time. Try again.", http: 504 },
  MATAN_AI_INVALID_RESPONSE: { title: "AI response invalid", message: "Nova returned something Matan couldn't validate. The event was left unanalyzed - you can retry.", http: 502 },
  MATAN_AI_UNAVAILABLE: { title: "AI analysis unavailable", message: "Amazon Bedrock is temporarily unavailable. Try again shortly.", http: 503 },
  MATAN_AI_EVENT_NOT_FOUND: { title: "Event not found", message: "That Ring event is no longer in the current history.", http: 404 },
  MATAN_AI_BAD_REQUEST: { title: "Invalid request", message: "An event id or event object is required.", http: 400 },
  MATAN_AI_BUDGET_EXCEEDED: { title: "AI budget reached", message: "This month's Matan AI token budget is used up. Raise MATAN_AI_MONTHLY_TOKEN_BUDGET or wait for the next month.", http: 429 },
};

export class MatanAiError extends Error {
  code: MatanAiErrorCode;
  constructor(code: MatanAiErrorCode, detail?: string) {
    super(detail ?? matanAiCopy[code].message);
    this.name = "MatanAiError";
    this.code = code;
  }
  toPayload() {
    return { code: this.code, title: matanAiCopy[this.code].title, message: this.message };
  }
  get http() {
    return matanAiCopy[this.code].http;
  }
}

/** Map AWS SDK / network errors to normalized codes. Never leaks stack traces or secrets. */
export function fromAwsError(e: unknown): MatanAiError {
  if (e instanceof MatanAiError) return e;
  const name = (e as { name?: string })?.name ?? "";
  const status = (e as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
  const msg = e instanceof Error ? e.message : "";
  if (/CredentialsProviderError|Could not load credentials|Missing credentials|Region is missing/i.test(`${name} ${msg}`)) return new MatanAiError("MATAN_AI_CONFIGURATION_ERROR");
  if (/AccessDenied|UnrecognizedClient|InvalidSignature|ExpiredToken|not authorized/i.test(`${name} ${msg}`) || status === 403) return new MatanAiError("MATAN_AI_ACCESS_DENIED");
  if (/Throttling|TooManyRequests|ServiceQuotaExceeded/i.test(name) || status === 429) return new MatanAiError("MATAN_AI_THROTTLED");
  if (/Timeout|AbortError|TimeoutError/i.test(name) || /timed out/i.test(msg)) return new MatanAiError("MATAN_AI_TIMEOUT");
  if (/ValidationException/i.test(name) && /video|image|media|format|bytes|size|too (large|long)|duration/i.test(msg)) return new MatanAiError("MATAN_AI_BAD_REQUEST", "Bedrock rejected the media attached to this analysis (unsupported or invalid clip/snapshot). Try the snapshot-only analysis.");
  if (/ResourceNotFound/i.test(name) || (/ValidationException/i.test(name) && /model/i.test(msg))) return new MatanAiError("MATAN_AI_CONFIGURATION_ERROR", "The configured Bedrock model id is not available in this region or account.");
  if (/ModelNotReady|ServiceUnavailable|InternalServer|ModelError/i.test(name) || (status && status >= 500)) return new MatanAiError("MATAN_AI_UNAVAILABLE");
  return new MatanAiError("MATAN_AI_UNAVAILABLE");
}
