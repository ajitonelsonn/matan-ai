// Send one test email through the same provider chain the app uses: SES first, then SMTP (nodemailer).
//   pnpm email:check [recipient]     (default recipient = SES_FROM_EMAIL)
// Never prints credentials.
import { readFileSync, existsSync } from "node:fs";
for (const line of existsSync(".env") ? readFileSync(".env", "utf8").split("\n") : []) { const m = line.match(/^\s*([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim(); }
const mask = (e) => (e ? e.replace(/^(.).*(@.*)$/, "$1***$2") : "(unset)");
const to = process.argv[2] || process.env.SES_FROM_EMAIL;
const provider = (process.env.EMAIL_PROVIDER ?? "auto").toLowerCase();
const sesOk = Boolean(process.env.SES_FROM_EMAIL), smtpOk = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD);
console.log(`config: EMAIL_PROVIDER=${provider} ses=${sesOk ? mask(process.env.SES_FROM_EMAIL) : "off"} smtp=${smtpOk ? `${process.env.SMTP_HOST}:${process.env.SMTP_PORT ?? 587} as ${mask(process.env.SMTP_USER)}` : "off"} to=${mask(to)}`);
const content = { subject: "Matan AI — email provider check", text: `Provider chain test from Matan AI.\nApp: ${process.env.APP_BASE_URL ?? ""}`, html: `<p>Provider chain test from <b>Matan AI</b>.</p>` };
const order = provider === "ses" ? ["ses"] : provider === "smtp" ? ["smtp"] : ["ses", "smtp"];
for (const p of order) {
  if (p === "ses" && !sesOk) continue;
  if (p === "smtp" && !smtpOk) continue;
  try {
    if (p === "ses") {
      const { SESv2Client, SendEmailCommand } = await import("@aws-sdk/client-sesv2");
      const r = await new SESv2Client({ region: process.env.AWS_REGION ?? "us-east-1" }).send(new SendEmailCommand({ FromEmailAddress: process.env.SES_FROM_EMAIL, Destination: { ToAddresses: [to] }, ConfigurationSetName: process.env.SES_CONFIGURATION_SET || "matan-ai", Content: { Simple: { Subject: { Data: content.subject }, Body: { Text: { Data: content.text }, Html: { Data: content.html } } } } }));
      console.log(`✓ SES delivered - MessageId: ${r.MessageId}`); process.exit(0);
    } else {
      const nodemailer = (await import("nodemailer")).default;
      const port = Number(process.env.SMTP_PORT ?? 587);
      const t = nodemailer.createTransport({ host: process.env.SMTP_HOST, port, secure: port === 465, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } });
      await t.verify(); console.log("✓ SMTP login ok");
      const info = await t.sendMail({ from: `Matan AI <${process.env.SMTP_FROM || process.env.SMTP_USER}>`, to, ...content });
      console.log(`✓ SMTP delivered - MessageId: ${info.messageId} response: ${String(info.response).slice(0, 60)}`); process.exit(0);
    }
  } catch (e) {
    console.log(`✖ ${p} failed: ${e.name ?? e.code ?? "Error"} - ${String(e.message).replace(/\d{12}/g, "<account-id>").slice(0, 160)}${order.indexOf(p) < order.length - 1 ? " → falling back" : ""}`);
  }
}
console.error("✖ no provider could deliver"); process.exit(1);
