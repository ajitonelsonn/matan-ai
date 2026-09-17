// Inspect AWS identity + existing Cognito pools using the server .env (never prints secrets).
import { readFileSync } from "node:fs";
for (const line of readFileSync(".env", "utf8").split("\n")) { const m = line.match(/^\s*([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim(); }
const { STSClient, GetCallerIdentityCommand } = await import("@aws-sdk/client-sts");
const { CognitoIdentityProviderClient, ListUserPoolsCommand } = await import("@aws-sdk/client-cognito-identity-provider");
const region = process.env.AWS_REGION ?? "us-east-1";
const id = await new STSClient({ region }).send(new GetCallerIdentityCommand({}));
console.log("region:", region, "| account:", id.Account.slice(0, 4) + "********", "| identity:", id.Arn.split("/").pop());
try {
  const pools = await new CognitoIdentityProviderClient({ region }).send(new ListUserPoolsCommand({ MaxResults: 60 }));
  console.log("user pools:", pools.UserPools?.length ?? 0);
  for (const p of pools.UserPools ?? []) console.log(" -", p.Name, p.Id);
} catch (e) { console.log("ListUserPools failed:", e.name, "-", e.message.slice(0, 160)); }
