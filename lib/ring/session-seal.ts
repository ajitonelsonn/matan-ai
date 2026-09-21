import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { RingAccount } from "./types";

/**
 * Sealing of the Ring Playground session for stateless runtimes: AES-256-GCM with a key
 * derived from RING_SESSION_SECRET. Pure (no Next.js request context) so it is testable.
 */
export interface SealedPayload {
  v: 1;
  id: string;
  token: string;
  createdAt: number;
  expiresAt: number;
  lastValidatedAt: number;
  invalidated: boolean;
  account: RingAccount | null;
}

export function sealKeyFrom(secret: string | undefined): Buffer | null {
  if (!secret || secret.length < 16) return null;
  return createHash("sha256").update(secret).digest();
}

export function seal(payload: SealedPayload, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString("base64url");
}

export function unseal(sealed: string, key: Buffer): SealedPayload | null {
  try {
    const buf = Buffer.from(sealed, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", key, buf.subarray(0, 12));
    decipher.setAuthTag(buf.subarray(12, 28));
    const json = Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8");
    const p = JSON.parse(json) as SealedPayload;
    return p && p.v === 1 && typeof p.id === "string" && typeof p.token === "string" ? p : null;
  } catch {
    return null;
  }
}

/** Split a sealed value into cookie-sized chunks (null when it would need too many). */
export function chunk(sealed: string, size: number, maxChunks: number): string[] | null {
  const parts = sealed.match(new RegExp(`.{1,${size}}`, "g")) ?? [];
  return parts.length > maxChunks ? null : parts;
}
