import "server-only";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DeleteCommand, DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

/**
 * Server-only DynamoDB access for the single `MatanAI` table.
 * Single-table design: PK = USER#{cognitoSub}, SK = <TYPE>#<id>.
 * Credentials come from the server environment (never NEXT_PUBLIC_*).
 */
export const DYNAMODB_TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || "MatanAI";

declare global {
  // eslint-disable-next-line no-var
  var __matanDynamo: DynamoDBDocumentClient | undefined;
}

export function dynamo() {
  if (!globalThis.__matanDynamo) {
    globalThis.__matanDynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION || "us-east-1" }), {
      marshallOptions: { removeUndefinedValues: true },
    });
  }
  return globalThis.__matanDynamo;
}

export const isDynamoConfigured = () => Boolean(process.env.AWS_ACCESS_KEY_ID || process.env.AWS_PROFILE || process.env.AWS_ROLE_ARN || process.env.AWS_WEB_IDENTITY_TOKEN_FILE || process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI);

/** Partition key derived ONLY from the verified Cognito sub. */
export const userPK = (sub: string) => `USER#${sub}`;

export const SK = {
  profile: "PROFILE",
  settings: "SETTINGS",
  device: (id: string) => `DEVICE#${id}`,
  event: (id: string) => `EVENT#${id}`,
  analysis: (id: string) => `ANALYSIS#${id}`,
} as const;

type Item = Record<string, unknown> & { PK: string; SK: string };

export class DynamoError extends Error {
  code: "DYNAMO_NOT_CONFIGURED" | "DYNAMO_ACCESS_DENIED" | "DYNAMO_TABLE_NOT_FOUND" | "DYNAMO_THROTTLED" | "DYNAMO_NETWORK" | "DYNAMO_ERROR";
  constructor(code: DynamoError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

/** Map SDK failures to safe codes; never include credentials or raw ARNs. */
function wrap(e: unknown): DynamoError {
  const name = (e as { name?: string })?.name ?? "";
  if (/AccessDenied|UnrecognizedClient|InvalidSignature|CredentialsProviderError/i.test(name)) return new DynamoError("DYNAMO_ACCESS_DENIED", "DynamoDB access denied for this identity.");
  if (/ResourceNotFound/i.test(name)) return new DynamoError("DYNAMO_TABLE_NOT_FOUND", `DynamoDB table ${DYNAMODB_TABLE_NAME} was not found.`);
  if (/Throttling|ProvisionedThroughputExceeded|RequestLimitExceeded/i.test(name)) return new DynamoError("DYNAMO_THROTTLED", "DynamoDB is throttling requests; try again shortly.");
  if (/ENOTFOUND|ECONNRESET|ETIMEDOUT|TimeoutError|NetworkingError/i.test(name + (e as { code?: string })?.code)) return new DynamoError("DYNAMO_NETWORK", "Could not reach DynamoDB.");
  return new DynamoError("DYNAMO_ERROR", "DynamoDB request failed.");
}

async function run<T>(op: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    const err = wrap(e);
    console.error({ event: "dynamodb_error", op, code: err.code, name: (e as { name?: string })?.name });
    throw err;
  }
}

export async function getItem<T extends object>(pk: string, sk: string): Promise<T | null> {
  const r = await run("GetItem", () => dynamo().send(new GetCommand({ TableName: DYNAMODB_TABLE_NAME, Key: { PK: pk, SK: sk } })));
  return (r.Item as T | undefined) ?? null;
}

export async function putItem(item: Item) {
  await run("PutItem", () => dynamo().send(new PutCommand({ TableName: DYNAMODB_TABLE_NAME, Item: { ...item, updatedAt: new Date().toISOString() } })));
}

/** Create only when absent (idempotent inserts); returns false when the item already exists. */
export async function putIfAbsent(item: Item) {
  try {
    await dynamo().send(new PutCommand({ TableName: DYNAMODB_TABLE_NAME, Item: { ...item, createdAt: new Date().toISOString() }, ConditionExpression: "attribute_not_exists(PK)" }));
    return true;
  } catch (e) {
    if ((e as { name?: string })?.name === "ConditionalCheckFailedException") return false;
    const err = wrap(e);
    console.error({ event: "dynamodb_error", op: "PutItem(conditional)", code: err.code });
    throw err;
  }
}

export async function updateItem(pk: string, sk: string, attrs: Record<string, unknown>) {
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = { ":updatedAt": new Date().toISOString() };
  const sets = ["#updatedAt = :updatedAt"];
  names["#updatedAt"] = "updatedAt";
  Object.entries(attrs).forEach(([k, v], i) => {
    if (v === undefined) return;
    names[`#a${i}`] = k;
    values[`:v${i}`] = v;
    sets.push(`#a${i} = :v${i}`);
  });
  await run("UpdateItem", () => dynamo().send(new UpdateCommand({ TableName: DYNAMODB_TABLE_NAME, Key: { PK: pk, SK: sk }, UpdateExpression: `SET ${sets.join(", ")}`, ExpressionAttributeNames: names, ExpressionAttributeValues: values })));
}

export async function deleteItem(pk: string, sk: string) {
  await run("DeleteItem", () => dynamo().send(new DeleteCommand({ TableName: DYNAMODB_TABLE_NAME, Key: { PK: pk, SK: sk } })));
}

/** All items of one type for one user (`begins_with(SK, prefix)`; empty prefix = whole partition), following LastEvaluatedKey. Never scans. */
export async function queryPrefix<T extends object>(pk: string, prefix: string, opts: { limit?: number } = {}): Promise<T[]> {
  const out: T[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const r = await run("Query", () =>
      dynamo().send(
        new QueryCommand({
          TableName: DYNAMODB_TABLE_NAME,
          KeyConditionExpression: prefix ? "PK = :pk AND begins_with(SK, :prefix)" : "PK = :pk",
          ExpressionAttributeValues: prefix ? { ":pk": pk, ":prefix": prefix } : { ":pk": pk },
          ExclusiveStartKey,
          Limit: opts.limit ? Math.max(1, opts.limit - out.length) : undefined,
        }),
      ),
    );
    out.push(...((r.Items as T[] | undefined) ?? []));
    ExclusiveStartKey = r.LastEvaluatedKey as Record<string, unknown> | undefined;
    if (opts.limit && out.length >= opts.limit) break;
  } while (ExclusiveStartKey);
  return out;
}

/** Strip table keys/bookkeeping before handing an item to application code. */
export function stripKeys<T>(item: Record<string, unknown>): T {
  const { PK: _pk, SK: _sk, createdAt: _c, updatedAt: _u, ...rest } = item;
  return rest as T;
}
