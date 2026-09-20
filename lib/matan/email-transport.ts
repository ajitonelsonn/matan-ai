import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { isSesConfigured, sendEmail as sendViaSes, SesError, type EmailNotification } from "@/lib/aws/ses";
import { chooseFallback, type EmailProvider, type SendResult } from "./email-provider";

/**
 * Email transport with fallback:
 *   Amazon SES (primary, `matan-ai` configuration set)
 *   → SMTP via nodemailer (fallback while SES is in Sandbox, or when SES is unavailable)
 *
 * EMAIL_PROVIDER = auto (default) | ses | smtp
 * SMTP_* are server-only; the SMTP password is never logged.
 */
export const EMAIL_PROVIDER = ((process.env.EMAIL_PROVIDER ?? "auto").toLowerCase() as "auto" | EmailProvider) || "auto";

const SMTP = {
  host: process.env.SMTP_HOST ?? "",
  port: Number(process.env.SMTP_PORT ?? 587),
  user: process.env.SMTP_USER ?? "",
  password: process.env.SMTP_PASSWORD ?? "",
  from: process.env.SMTP_FROM || process.env.SMTP_USER || "",
};

export const isSmtpConfigured = () => Boolean(SMTP.host && SMTP.user && SMTP.password && SMTP.from);

declare global {
  // eslint-disable-next-line no-var
  var __matanSmtp: Transporter | undefined;
}

function transporter() {
  if (!globalThis.__matanSmtp) {
    globalThis.__matanSmtp = nodemailer.createTransport({
      host: SMTP.host,
      port: SMTP.port,
      secure: SMTP.port === 465,
      auth: { user: SMTP.user, pass: SMTP.password },
      connectionTimeout: 10_000,
      socketTimeout: 20_000,
    });
  }
  return globalThis.__matanSmtp;
}

export class SmtpError extends Error {
  code: "SMTP_CONFIGURATION_ERROR" | "SMTP_AUTH" | "SMTP_REJECTED" | "SMTP_NETWORK" | "SMTP_ERROR";
  constructor(code: SmtpError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

function mapSmtpError(e: unknown): SmtpError {
  const code = (e as { code?: string })?.code ?? "";
  const rc = (e as { responseCode?: number })?.responseCode;
  if (code === "EAUTH" || rc === 535 || rc === 534) return new SmtpError("SMTP_AUTH", "SMTP authentication failed.");
  if (code === "EENVELOPE" || (rc && rc >= 500)) return new SmtpError("SMTP_REJECTED", "SMTP server rejected the message.");
  if (/ECONN|ETIMEDOUT|ESOCKET|EDNS|ENOTFOUND/.test(code)) return new SmtpError("SMTP_NETWORK", "Could not reach the SMTP server.");
  return new SmtpError("SMTP_ERROR", "SMTP send failed.");
}

export async function sendViaSmtp(n: EmailNotification): Promise<{ messageId: string }> {
  if (!isSmtpConfigured()) throw new SmtpError("SMTP_CONFIGURATION_ERROR", "SMTP_* variables are not set.");
  try {
    const info = await transporter().sendMail({ from: `Matan AI <${SMTP.from}>`, to: n.to, replyTo: n.replyTo, subject: n.subject, text: n.text, html: n.html });
    return { messageId: info.messageId ?? "" };
  } catch (e) {
    throw mapSmtpError(e);
  }
}

/**
 * Send with SES, falling back to SMTP when SES fails for a reason the fallback can
 * plausibly fix (Sandbox rejection, access denied, not configured, throttled, network).
 * Throws the *last* error only when every configured provider failed.
 */
export async function sendWithFallback(n: EmailNotification, log: (entry: Record<string, unknown>) => void = console.info): Promise<SendResult> {
  const providers = { ses: isSesConfigured(), smtp: isSmtpConfigured() };
  const order: EmailProvider[] = EMAIL_PROVIDER === "ses" ? ["ses"] : EMAIL_PROVIDER === "smtp" ? ["smtp"] : ["ses", "smtp"];
  let lastError: unknown = new SesError("SES_CONFIGURATION_ERROR", "No email provider is configured.");
  for (const provider of order) {
    if (!providers[provider]) continue;
    try {
      const r = provider === "ses" ? await sendViaSes(n) : await sendViaSmtp(n);
      return { provider, messageId: r.messageId };
    } catch (e) {
      lastError = e;
      const code = (e as { code?: string })?.code ?? "error";
      const next = chooseFallback(provider, code, order, providers);
      log({ event: next ? "email_provider_fallback" : "email_provider_failed", provider, code, ...(next ? { next } : {}) });
      if (!next) break;
    }
  }
  throw lastError;
}
