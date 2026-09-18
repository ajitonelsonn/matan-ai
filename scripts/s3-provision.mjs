// Create the private Matan AI media bucket (idempotent). Never prints secrets.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import crypto from "node:crypto";
for (const line of existsSync(".env") ? readFileSync(".env", "utf8").split("\n") : []) { const m = line.match(/^\s*([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim(); }
const { S3Client, CreateBucketCommand, PutPublicAccessBlockCommand, PutBucketOwnershipControlsCommand, PutBucketEncryptionCommand, HeadBucketCommand, GetPublicAccessBlockCommand, GetBucketEncryptionCommand } = await import("@aws-sdk/client-s3");
const region = process.env.AWS_REGION ?? "us-east-1";
const s3 = new S3Client({ region });
const fail = (op, e) => { console.error(`✖ AWS operation failed: ${op}\n  ${e.name}: ${String(e.message).replace(/\d{12}/g, "<account-id>").slice(0, 200)}`); process.exit(1); };
let bucket = process.env.S3_MEDIA_BUCKET;
if (bucket) {
  try { await s3.send(new HeadBucketCommand({ Bucket: bucket })); console.log(`✓ Reusing bucket ${bucket}`); } catch (e) { fail("s3:HeadBucket", e); }
} else {
  bucket = `matan-ai-media-${crypto.randomBytes(4).toString("hex")}`;
  try { await s3.send(new CreateBucketCommand({ Bucket: bucket, ObjectOwnership: "BucketOwnerEnforced" })); console.log(`✓ Created bucket ${bucket} (${region})`); } catch (e) { fail("s3:CreateBucket", e); }
}
try { await s3.send(new PutPublicAccessBlockCommand({ Bucket: bucket, PublicAccessBlockConfiguration: { BlockPublicAcls: true, IgnorePublicAcls: true, BlockPublicPolicy: true, RestrictPublicBuckets: true } })); console.log("✓ Block all public access: ON"); } catch (e) { fail("s3:PutBucketPublicAccessBlock", e); }
try { await s3.send(new PutBucketOwnershipControlsCommand({ Bucket: bucket, OwnershipControls: { Rules: [{ ObjectOwnership: "BucketOwnerEnforced" }] } })); console.log("✓ Object Ownership: Bucket owner enforced (ACLs disabled)"); } catch (e) { fail("s3:PutBucketOwnershipControls", e); }
try { await s3.send(new PutBucketEncryptionCommand({ Bucket: bucket, ServerSideEncryptionConfiguration: { Rules: [{ ApplyServerSideEncryptionByDefault: { SSEAlgorithm: "AES256" }, BucketKeyEnabled: true }] } })); console.log("✓ Default encryption: SSE-S3 (AES256)"); } catch (e) { fail("s3:PutEncryptionConfiguration", e); }
try { const pab = await s3.send(new GetPublicAccessBlockCommand({ Bucket: bucket })); const enc = await s3.send(new GetBucketEncryptionCommand({ Bucket: bucket })); console.log("✓ Verified:", JSON.stringify(pab.PublicAccessBlockConfiguration), enc.ServerSideEncryptionConfiguration.Rules[0].ApplyServerSideEncryptionByDefault.SSEAlgorithm); } catch { /* verification is best-effort */ }
let env = existsSync(".env") ? readFileSync(".env", "utf8") : "";
if (/^S3_MEDIA_BUCKET=.*$/m.test(env)) env = env.replace(/^S3_MEDIA_BUCKET=.*$/m, `S3_MEDIA_BUCKET=${bucket}`); else env = `${env.replace(/\n*$/, "\n")}\n# --- S3 media bucket (server-only) ---\nS3_MEDIA_BUCKET=${bucket}\n`;
writeFileSync(".env", env);
console.log(`✓ .env S3_MEDIA_BUCKET=${bucket}`);
console.log(`\nIAM: allow s3:GetObject, s3:PutObject, s3:DeleteObject on arn:aws:s3:::${bucket}/* (and s3:ListBucket on arn:aws:s3:::${bucket} if needed).`);
