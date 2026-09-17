#!/usr/bin/env node
/**
 * Provision the Amazon Cognito resources for Matan AI (idempotent).
 *
 *   pnpm cognito:provision            create/reuse pool, app client, domain; write NEXT_PUBLIC_* to .env
 *   pnpm cognito:provision --dry-run  show what would happen without creating anything
 *
 * Reads AWS credentials from the environment / .env (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION).
 * Optional: GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET to configure the Google identity provider.
 * Optional: MATAN_APP_ORIGINS="http://localhost:3000,https://app.example.com" for extra callback origins.
 *
 * Never prints secret values. Requires cognito-idp permissions listed in docs/COGNITO_AUTH_IMPLEMENTATION.md.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";

for (const line of existsSync(".env") ? readFileSync(".env", "utf8").split("\n") : []) {
  const m = line.match(/^\s*([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"(.*)"$/, "$1");
}

const {
  CognitoIdentityProviderClient,
  ListUserPoolsCommand,
  CreateUserPoolCommand,
  DescribeUserPoolCommand,
  ListUserPoolClientsCommand,
  CreateUserPoolClientCommand,
  UpdateUserPoolClientCommand,
  DescribeUserPoolClientCommand,
  DescribeUserPoolDomainCommand,
  CreateUserPoolDomainCommand,
  DescribeIdentityProviderCommand,
  CreateIdentityProviderCommand,
  UpdateIdentityProviderCommand,
} = await import("@aws-sdk/client-cognito-identity-provider");

const dryRun = process.argv.includes("--dry-run");
const region = process.env.AWS_REGION ?? "us-east-1";
const POOL_NAME = "MatanAI-Users";
const CLIENT_NAME = "matan-ai-web";
const origins = (process.env.MATAN_APP_ORIGINS ?? "http://localhost:3000").split(",").map((s) => s.trim()).filter(Boolean);
const callbackUrls = origins.map((o) => `${o}/auth/callback`);
const logoutUrls = origins.map((o) => `${o}/`);
const googleId = process.env.GOOGLE_CLIENT_ID;
const googleSecret = process.env.GOOGLE_CLIENT_SECRET;
const googleReady = Boolean(googleId && googleSecret);

const c = new CognitoIdentityProviderClient({ region });
const log = (...a) => console.log(...a);

async function step(op, fn) {
  try {
    return await fn();
  } catch (e) {
    console.error(`\n✖ AWS operation failed: ${op}`);
    console.error(`  ${e.name}: ${String(e.message).replace(/arn:aws:iam::\d{8}(\d{4})/g, "arn:aws:iam::********$1").slice(0, 300)}`);
    process.exit(1);
  }
}

// 1. User pool ------------------------------------------------------------
const pools = await step("cognito-idp:ListUserPools", () => c.send(new ListUserPoolsCommand({ MaxResults: 60 })));
let pool = (pools.UserPools ?? []).find((p) => p.Name === POOL_NAME);
if (pool) log(`✓ Reusing user pool ${POOL_NAME} (${pool.Id})`);
else if (dryRun) log(`• Would create user pool ${POOL_NAME}`);
else {
  const r = await step("cognito-idp:CreateUserPool", () =>
    c.send(
      new CreateUserPoolCommand({
        PoolName: POOL_NAME,
        UsernameAttributes: ["email"],
        AutoVerifiedAttributes: ["email"],
        UsernameConfiguration: { CaseSensitive: false },
        Policies: { PasswordPolicy: { MinimumLength: 8, RequireUppercase: true, RequireLowercase: true, RequireNumbers: true, RequireSymbols: true, TemporaryPasswordValidityDays: 7 } },
        Schema: [
          { Name: "email", AttributeDataType: "String", Required: true, Mutable: true },
          { Name: "name", AttributeDataType: "String", Required: true, Mutable: true },
        ],
        AccountRecoverySetting: { RecoveryMechanisms: [{ Name: "verified_email", Priority: 1 }] },
        AdminCreateUserConfig: { AllowAdminCreateUserOnly: false },
        EmailConfiguration: { EmailSendingAccount: "COGNITO_DEFAULT" },
        VerificationMessageTemplate: { DefaultEmailOption: "CONFIRM_WITH_CODE", EmailSubject: "Your Matan AI verification code", EmailMessage: "Your Matan AI verification code is {####}." },
        UserAttributeUpdateSettings: { AttributesRequireVerificationBeforeUpdate: ["email"] },
        DeletionProtection: "ACTIVE",
        UserPoolTier: "ESSENTIALS",
        UserPoolTags: { Project: "MatanAI" },
      }),
    ),
  );
  pool = r.UserPool;
  log(`✓ Created user pool ${POOL_NAME} (${pool.Id})`);
}
const poolId = pool?.Id;

// 2. Google identity provider (only with real credentials) -----------------
let googleConfigured = false;
if (poolId && googleReady) {
  const existing = await c.send(new DescribeIdentityProviderCommand({ UserPoolId: poolId, ProviderName: "Google" })).catch(() => null);
  const details = { client_id: googleId, client_secret: googleSecret, authorize_scopes: "openid email profile" };
  const mapping = { email: "email", name: "name", picture: "picture", username: "sub" };
  if (dryRun) log(`• Would ${existing ? "update" : "create"} Google identity provider`);
  else if (existing) {
    await step("cognito-idp:UpdateIdentityProvider", () => c.send(new UpdateIdentityProviderCommand({ UserPoolId: poolId, ProviderName: "Google", ProviderDetails: details, AttributeMapping: mapping })));
    log("✓ Updated Google identity provider");
  } else {
    await step("cognito-idp:CreateIdentityProvider", () => c.send(new CreateIdentityProviderCommand({ UserPoolId: poolId, ProviderName: "Google", ProviderType: "Google", ProviderDetails: details, AttributeMapping: mapping })));
    log("✓ Created Google identity provider");
  }
  googleConfigured = true;
} else if (poolId) {
  const existing = await c.send(new DescribeIdentityProviderCommand({ UserPoolId: poolId, ProviderName: "Google" })).catch(() => null);
  googleConfigured = Boolean(existing);
  log(googleConfigured ? "✓ Google identity provider already configured" : "• Google identity provider pending (set GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET, then re-run)");
}

// 3. App client (public, no secret, code flow) -----------------------------
let clientId;
if (poolId) {
  const clients = await step("cognito-idp:ListUserPoolClients", () => c.send(new ListUserPoolClientsCommand({ UserPoolId: poolId, MaxResults: 60 })));
  const found = (clients.UserPoolClients ?? []).find((k) => k.ClientName === CLIENT_NAME);
  const clientConfig = {
    UserPoolId: poolId,
    ClientName: CLIENT_NAME,
    ExplicitAuthFlows: ["ALLOW_USER_SRP_AUTH", "ALLOW_USER_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"],
    SupportedIdentityProviders: googleConfigured ? ["COGNITO", "Google"] : ["COGNITO"],
    CallbackURLs: callbackUrls,
    LogoutURLs: logoutUrls,
    AllowedOAuthFlows: ["code"],
    AllowedOAuthScopes: ["openid", "email", "profile"],
    AllowedOAuthFlowsUserPoolClient: true,
    PreventUserExistenceErrors: "ENABLED",
    EnableTokenRevocation: true,
    AccessTokenValidity: 60,
    IdTokenValidity: 60,
    RefreshTokenValidity: 30,
    TokenValidityUnits: { AccessToken: "minutes", IdToken: "minutes", RefreshToken: "days" },
  };
  if (found) {
    clientId = found.ClientId;
    if (dryRun) log(`• Would update app client ${CLIENT_NAME} (${clientId})`);
    else {
      await step("cognito-idp:UpdateUserPoolClient", () => c.send(new UpdateUserPoolClientCommand({ ...clientConfig, ClientId: clientId })));
      log(`✓ Updated app client ${CLIENT_NAME} (${clientId})`);
    }
  } else if (dryRun) log(`• Would create app client ${CLIENT_NAME}`);
  else {
    const r = await step("cognito-idp:CreateUserPoolClient", () => c.send(new CreateUserPoolClientCommand({ ...clientConfig, GenerateSecret: false })));
    clientId = r.UserPoolClient.ClientId;
    log(`✓ Created app client ${CLIENT_NAME} (${clientId})`);
  }
  if (clientId && !dryRun) {
    const d = await c.send(new DescribeUserPoolClientCommand({ UserPoolId: poolId, ClientId: clientId }));
    if (d.UserPoolClient?.ClientSecret) console.error("✖ App client has a secret - a public SPA client must not. Recreate without GenerateSecret.");
  }
}

// 4. Managed login domain --------------------------------------------------
let domain;
if (poolId) {
  const described = await step("cognito-idp:DescribeUserPool", () => c.send(new DescribeUserPoolCommand({ UserPoolId: poolId })));
  domain = described.UserPool?.Domain;
  if (domain) log(`✓ Reusing domain ${domain}.auth.${region}.amazoncognito.com`);
  else {
    const prefix = `matan-ai-${poolId.split("_")[1].toLowerCase().slice(0, 8)}`;
    if (dryRun) log(`• Would create domain ${prefix}.auth.${region}.amazoncognito.com`);
    else {
      await step("cognito-idp:CreateUserPoolDomain", () => c.send(new CreateUserPoolDomainCommand({ UserPoolId: poolId, Domain: prefix, ManagedLoginVersion: 2 })));
      const st = await c.send(new DescribeUserPoolDomainCommand({ Domain: prefix }));
      domain = prefix;
      log(`✓ Created domain ${prefix}.auth.${region}.amazoncognito.com (${st.DomainDescription?.Status ?? "CREATING"})`);
    }
  }
}

// 5. Write public identifiers to .env --------------------------------------
if (poolId && clientId && domain && !dryRun) {
  const values = {
    NEXT_PUBLIC_AWS_REGION: region,
    NEXT_PUBLIC_COGNITO_USER_POOL_ID: poolId,
    NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID: clientId,
    NEXT_PUBLIC_COGNITO_DOMAIN: `${domain}.auth.${region}.amazoncognito.com`,
    NEXT_PUBLIC_COGNITO_GOOGLE_ENABLED: String(googleConfigured),
  };
  let env = existsSync(".env") ? readFileSync(".env", "utf8") : "";
  for (const [k, v] of Object.entries(values)) {
    const re = new RegExp(`^${k}=.*$`, "m");
    env = re.test(env) ? env.replace(re, `${k}=${v}`) : `${env.replace(/\n*$/, "\n")}${k}=${v}\n`;
  }
  writeFileSync(".env", env);
  log("\n✓ Wrote public Cognito identifiers to .env:");
  for (const [k, v] of Object.entries(values)) log(`  ${k}=${v}`);
  log("\nRestart the dev server (pnpm dev) to pick them up.");
}
if (!googleConfigured) log("\nGoogle sign-in: PENDING - create OAuth credentials in Google Cloud Console with redirect URI");
if (!googleConfigured && domain) log(`  https://${domain}.auth.${region}.amazoncognito.com/oauth2/idpresponse`);
