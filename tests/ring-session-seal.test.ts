import { test } from "node:test";
import assert from "node:assert/strict";
import { chunk, seal, sealKeyFrom, unseal, type SealedPayload } from "../lib/ring/session-seal";

const payload: SealedPayload = { v: 1, id: "sess-1", token: "x".repeat(2000), createdAt: 1, expiresAt: 2, lastValidatedAt: 1, invalidated: false, account: null };

test("Ring session seals and unseals with the same secret; token never appears in clear text", () => {
  const key = sealKeyFrom("a-long-random-secret-for-tests-0123456789")!;
  const sealed = seal(payload, key);
  assert.ok(!sealed.includes("xxxxxxxx"), "ciphertext must not contain the token");
  assert.deepEqual(unseal(sealed, key), payload);
});

test("tampering or a different secret yields null instead of a session", () => {
  const key = sealKeyFrom("a-long-random-secret-for-tests-0123456789")!;
  const other = sealKeyFrom("another-secret-that-is-long-enough-987654")!;
  const sealed = seal(payload, key);
  assert.equal(unseal(sealed, other), null);
  assert.equal(unseal(sealed.slice(0, -4) + "AAAA", key), null);
  assert.equal(unseal("not-base64!!", key), null);
});

test("short or missing secrets disable sealing; chunking respects cookie limits", () => {
  assert.equal(sealKeyFrom(undefined), null);
  assert.equal(sealKeyFrom("short"), null);
  const parts = chunk("a".repeat(8000), 3500, 4)!;
  assert.deepEqual(parts.map((p) => p.length), [3500, 3500, 1000]);
  assert.equal(chunk("a".repeat(20000), 3500, 4), null);
});
