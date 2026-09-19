// Send one SES test email from the verified sender to a verified recipient via the matan-ai configuration set.
//   pnpm ses:check                 → recipient = SES_FROM_EMAIL (always verified)
//   pnpm ses:check you@domain.com  → explicit recipient (must be verified while in Sandbox)
// Never prints credentials. Not exposed as an API route.
import { readFileSync, existsSync } from "node:fs";
for (const line of existsSync(".env") ? readFileSync(".env", "utf8").split("\n") : []) { const m = line.match(/^\s*([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim(); }
const { SESv2Client, SendEmailCommand, GetAccountCommand, GetConfigurationSetCommand } = await import("@aws-sdk/client-sesv2");
const region = process.env.AWS_REGION ?? "us-east-1";
const from = process.env.SES_FROM_EMAIL; const cfg = process.env.SES_CONFIGURATION_SET || "matan-ai"; const base = process.env.APP_BASE_URL || "http://localhost:3000";
const to = process.argv[2] || from;
const mask = (e) => e.replace(/^(.).*(@.*)$/, "$1***$2");
if (!from) { console.error("✖ SES_FROM_EMAIL is not set in .env"); process.exit(1); }
console.log(`config: region=${region} from=${mask(from)} to=${mask(to)} configurationSet=${cfg} appBaseUrl=${base}`);
const ses = new SESv2Client({ region });
try { const a = await ses.send(new GetAccountCommand({})); console.log(`✓ account: production=${a.ProductionAccessEnabled} sendingEnabled=${a.SendingEnabled} quota24h=${a.SendQuota?.Max24HourSend} maxRate=${a.SendQuota?.MaxSendRate}/s`); } catch (e) { console.log(`• GetAccount not permitted (${e.name}) - continuing`); }
try { await ses.send(new GetConfigurationSetCommand({ ConfigurationSetName: cfg })); console.log(`✓ configuration set ${cfg} exists`); } catch (e) { console.log(`• GetConfigurationSet ${cfg}: ${e.name} - continuing (SendEmail will validate it)`); }
try {
  const r = await ses.send(new SendEmailCommand({
    FromEmailAddress: from, Destination: { ToAddresses: [to] }, ConfigurationSetName: cfg,
    Content: { Simple: { Subject: { Data: "Matan AI — SES test email", Charset: "UTF-8" }, Body: { Text: { Data: `This is a test email from Matan AI.\n\nSender: ${from}\nConfiguration set: ${cfg}\nApp: ${base}\n\nIf you received this, SES transactional notifications are working.`, Charset: "UTF-8" }, Html: { Data: `<p>This is a <b>test email</b> from Matan AI.</p><p>Configuration set: <code>${cfg}</code><br>App: <a href="${base}">${base}</a></p>`, Charset: "UTF-8" } } } },
  }));
  console.log(`✓ SendEmail ok - MessageId: ${r.MessageId}`);
} catch (e) { console.error(`✖ SendEmail failed: ${e.name} - ${String(e.message).replace(/\d{12}/g, "<account-id>").slice(0, 200)}`); process.exit(1); }
