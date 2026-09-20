import "server-only";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

/** Server-only Amazon SES v2 client. Sender/config set come from the server environment. */
export const SES_FROM_EMAIL = process.env.SES_FROM_EMAIL ?? "";
export const SES_CONFIGURATION_SET = process.env.SES_CONFIGURATION_SET || "matan-ai";
export const APP_BASE_URL = (process.env.APP_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
export const isSesConfigured = () => Boolean(SES_FROM_EMAIL);

declare global {
  // eslint-disable-next-line no-var
  var __matanSes: SESv2Client | undefined;
}

export function ses() {
  if (!globalThis.__matanSes) globalThis.__matanSes = new SESv2Client({ region: process.env.AWS_REGION || "us-east-1" });
  return globalThis.__matanSes;
}

export type SesErrorCode = "SES_CONFIGURATION_ERROR" | "SES_ACCESS_DENIED" | "SES_MESSAGE_REJECTED" | "SES_THROTTLED" | "SES_NETWORK" | "SES_ERROR";

export class SesError extends Error {
  code: SesErrorCode;
  constructor(code: SesErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

/** Map SDK failures to safe codes. Sandbox rejections (unverified recipient) surface as SES_MESSAGE_REJECTED. */
export function mapSesError(e: unknown): SesError {
  const name = (e as { name?: string })?.name ?? "";
  const msg = (e as { message?: string })?.message ?? "";
  if (/AccessDenied|UnrecognizedClient|InvalidSignature|CredentialsProviderError/i.test(name)) return new SesError("SES_ACCESS_DENIED", "Email service access denied for this identity.");
  if (/MessageRejected|MailFromDomainNotVerified|BadRequestException|NotFoundException/i.test(name) || /not verified|Email address is not verified/i.test(msg)) return new SesError("SES_MESSAGE_REJECTED", "Email was rejected by the email service.");
  if (/TooManyRequests|Throttling|LimitExceeded|SendingPausedException/i.test(name)) return new SesError("SES_THROTTLED", "Email service is throttling requests.");
  if (/ENOTFOUND|ECONNRESET|ETIMEDOUT|TimeoutError|NetworkingError/i.test(name + (e as { code?: string })?.code)) return new SesError("SES_NETWORK", "Could not reach the email service.");
  return new SesError("SES_ERROR", "Email request failed.");
}

export interface EmailNotification {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  /** Inline images (cid:) or files. When present the message is sent as raw MIME. */
  attachments?: { filename: string; content: Uint8Array; contentType: string; cid?: string }[];
}

/** Build a raw RFC 5322 message (multipart/related with inline images) using nodemailer's composer. */
export async function composeRawMime(n: EmailNotification): Promise<Uint8Array> {
  const { default: MailComposer } = await import("nodemailer/lib/mail-composer");
  const composer = new MailComposer({
    from: `Matan AI <${SES_FROM_EMAIL}>`,
    to: n.to,
    replyTo: n.replyTo,
    subject: n.subject,
    text: n.text,
    html: n.html,
    attachments: n.attachments?.map((a) => ({ filename: a.filename, content: Buffer.from(a.content), contentType: a.contentType, cid: a.cid, contentDisposition: a.cid ? "inline" : "attachment" })),
  });
  return new Uint8Array(await composer.compile().build());
}

/** SES v2 SendEmail with Content.Simple (text + optional HTML), always through the Matan configuration set. */
export async function sendEmail(n: EmailNotification): Promise<{ messageId: string }> {
  if (!isSesConfigured()) throw new SesError("SES_CONFIGURATION_ERROR", "SES_FROM_EMAIL is not set.");
  try {
    if (n.attachments?.length) {
      const raw = await composeRawMime(n);
      const r = await ses().send(new SendEmailCommand({ FromEmailAddress: SES_FROM_EMAIL, Destination: { ToAddresses: [n.to] }, ConfigurationSetName: SES_CONFIGURATION_SET, Content: { Raw: { Data: raw } } }));
      return { messageId: r.MessageId ?? "" };
    }
    const r = await ses().send(
      new SendEmailCommand({
        FromEmailAddress: SES_FROM_EMAIL,
        Destination: { ToAddresses: [n.to] },
        ReplyToAddresses: n.replyTo ? [n.replyTo] : undefined,
        ConfigurationSetName: SES_CONFIGURATION_SET,
        Content: {
          Simple: {
            Subject: { Data: n.subject, Charset: "UTF-8" },
            Body: { Text: { Data: n.text, Charset: "UTF-8" }, Html: n.html ? { Data: n.html, Charset: "UTF-8" } : undefined },
          },
        },
      }),
    );
    return { messageId: r.MessageId ?? "" };
  } catch (e) {
    throw mapSesError(e);
  }
}
