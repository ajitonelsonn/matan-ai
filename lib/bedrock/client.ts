import "server-only";
import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";

/**
 * Server-only Amazon Bedrock Runtime client. Credentials come from the normal
 * AWS SDK provider chain (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_REGION
 * in the server environment). Nothing here is ever imported by client code.
 */
export const BEDROCK_REGION = process.env.AWS_REGION ?? "us-east-1";
export const BEDROCK_MODEL_ID = process.env.BEDROCK_MODEL_ID ?? "amazon.nova-pro-v1:0";

let client: BedrockRuntimeClient | null = null;

export function getBedrockClient() {
  if (!client) client = new BedrockRuntimeClient({ region: BEDROCK_REGION });
  return client;
}

/** True when the server has enough configuration to attempt a Bedrock call. */
export function isBedrockConfigured() {
  return Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) || Boolean(process.env.AWS_PROFILE) || Boolean(process.env.AWS_WEB_IDENTITY_TOKEN_FILE) || Boolean(process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI);
}
