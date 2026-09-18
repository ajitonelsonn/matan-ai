// Verify bucket access + PutObject/GetObject/DeleteObject with a temporary object. Never prints secrets.
import { readFileSync, existsSync } from "node:fs";
for (const line of existsSync(".env") ? readFileSync(".env", "utf8").split("\n") : []) { const m = line.match(/^\s*([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim(); }
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadBucketCommand } = await import("@aws-sdk/client-s3");
const region = process.env.AWS_REGION ?? "us-east-1"; const bucket = process.env.S3_MEDIA_BUCKET;
if (!bucket) { console.error("✖ S3_MEDIA_BUCKET is not set in .env"); process.exit(1); }
const s3 = new S3Client({ region }); const key = `connectivity-check/${Date.now()}.txt`;
const step = async (op, fn) => { try { const r = await fn(); console.log(`✓ ${op}`); return r; } catch (e) { console.error(`✖ ${op}: ${e.name} ${String(e.message).replace(/\d{12}/g, "<account-id>").slice(0, 160)}`); process.exit(1); } };
await step(`s3:HeadBucket ${bucket}`, () => s3.send(new HeadBucketCommand({ Bucket: bucket })));
await step("s3:PutObject", () => s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: "matan-ai connectivity check", ContentType: "text/plain" })));
const got = await step("s3:GetObject", () => s3.send(new GetObjectCommand({ Bucket: bucket, Key: key })));
console.log(`  content-type=${got.ContentType} sse=${got.ServerSideEncryption} bytes=${(await got.Body.transformToString()).length}`);
await step("s3:DeleteObject", () => s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })));
