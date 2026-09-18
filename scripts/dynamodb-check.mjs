// Connectivity check for the MatanAI DynamoDB table using the server .env (never prints secrets).
import { readFileSync, existsSync } from "node:fs";
for (const line of existsSync(".env") ? readFileSync(".env", "utf8").split("\n") : []) { const m = line.match(/^\s*([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim(); }
const { DynamoDBClient, DescribeTableCommand } = await import("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand } = await import("@aws-sdk/lib-dynamodb");
const region = process.env.AWS_REGION ?? "us-east-1";
const table = process.env.DYNAMODB_TABLE_NAME ?? "MatanAI";
const client = new DynamoDBClient({ region });
try {
  const d = await client.send(new DescribeTableCommand({ TableName: table }));
  const t = d.Table;
  console.log(`✓ DescribeTable ${table} (${region}): status=${t.TableStatus} keys=${t.KeySchema.map((k) => `${k.AttributeName}:${k.KeyType}`).join(",")} billing=${t.BillingModeSummary?.BillingMode ?? "PROVISIONED"} items≈${t.ItemCount}`);
  const g = await DynamoDBDocumentClient.from(client).send(new GetCommand({ TableName: table, Key: { PK: "USER#connectivity-check", SK: "PROFILE" } }));
  console.log(`✓ GetItem harmless probe: ${g.Item ? "item found" : "no item (expected)"}`);
} catch (e) {
  console.error(`✖ ${e.name}: ${String(e.message).replace(/\d{12}/g, "<account-id>").slice(0, 240)}`);
  process.exit(1);
}
