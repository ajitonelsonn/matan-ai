import "server-only";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

/** Server-only S3 access for the private Matan media bucket. Credentials come from the server environment. */
export const S3_MEDIA_BUCKET = process.env.S3_MEDIA_BUCKET ?? "";
export const isS3Configured = () => Boolean(S3_MEDIA_BUCKET);

declare global {
  // eslint-disable-next-line no-var
  var __matanS3: S3Client | undefined;
}

export function s3() {
  if (!globalThis.__matanS3) globalThis.__matanS3 = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });
  return globalThis.__matanS3;
}

export class S3Error extends Error {
  code: "S3_CONFIGURATION_ERROR" | "MEDIA_NOT_FOUND" | "S3_ACCESS_DENIED" | "S3_NETWORK" | "S3_ERROR";
  http: number;
  constructor(code: S3Error["code"], message: string, http = 500) {
    super(message);
    this.code = code;
    this.http = http;
  }
}

function wrap(e: unknown): S3Error {
  const name = (e as { name?: string })?.name ?? "";
  const status = (e as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
  if (/NoSuchKey|NotFound/i.test(name) || status === 404) return new S3Error("MEDIA_NOT_FOUND", "Media not found.", 404);
  if (/AccessDenied|InvalidAccessKeyId|SignatureDoesNotMatch|CredentialsProviderError/i.test(name) || status === 403) return new S3Error("S3_ACCESS_DENIED", "Media storage access denied.", 502);
  if (/NoSuchBucket/i.test(name)) return new S3Error("S3_CONFIGURATION_ERROR", "Media bucket is not configured correctly.", 500);
  if (/ENOTFOUND|ECONNRESET|ETIMEDOUT|TimeoutError|NetworkingError/i.test(name + (e as { code?: string })?.code)) return new S3Error("S3_NETWORK", "Could not reach media storage.", 502);
  return new S3Error("S3_ERROR", "Media storage request failed.", 502);
}

async function run<T>(op: string, fn: () => Promise<T>): Promise<T> {
  if (!isS3Configured()) throw new S3Error("S3_CONFIGURATION_ERROR", "S3_MEDIA_BUCKET is not set.", 500);
  try {
    return await fn();
  } catch (e) {
    const err = wrap(e);
    if (err.code !== "MEDIA_NOT_FOUND") console.error({ event: "s3_error", op, code: err.code, name: (e as { name?: string })?.name });
    throw err;
  }
}

export async function putObject(key: string, body: Uint8Array, contentType: string, metadata?: Record<string, string>) {
  await run("PutObject", () => s3().send(new PutObjectCommand({ Bucket: S3_MEDIA_BUCKET, Key: key, Body: body, ContentType: contentType, ContentLength: body.byteLength, Metadata: metadata })));
}

export interface S3ObjectStream {
  stream: ReadableStream<Uint8Array>;
  contentType?: string;
  contentLength?: number;
}

/** Streamed read - clips can be several MB; snapshots are small. */
export async function getObjectStream(key: string): Promise<S3ObjectStream> {
  const r = await run("GetObject", () => s3().send(new GetObjectCommand({ Bucket: S3_MEDIA_BUCKET, Key: key })));
  if (!r.Body) throw new S3Error("MEDIA_NOT_FOUND", "Media not found.", 404);
  return { stream: r.Body.transformToWebStream() as ReadableStream<Uint8Array>, contentType: r.ContentType, contentLength: r.ContentLength };
}

export async function getObjectBytes(key: string): Promise<{ bytes: Uint8Array; contentType?: string }> {
  const r = await run("GetObject", () => s3().send(new GetObjectCommand({ Bucket: S3_MEDIA_BUCKET, Key: key })));
  if (!r.Body) throw new S3Error("MEDIA_NOT_FOUND", "Media not found.", 404);
  return { bytes: await r.Body.transformToByteArray(), contentType: r.ContentType };
}

export async function deleteObject(key: string) {
  await run("DeleteObject", () => s3().send(new DeleteObjectCommand({ Bucket: S3_MEDIA_BUCKET, Key: key })));
}
