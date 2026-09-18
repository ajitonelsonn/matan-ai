import { test } from "node:test";
import assert from "node:assert/strict";
import { extensionFor, isSafeId, keyBelongsTo, mediaIdFor, mediaKey, parseMediaRequest } from "../lib/matan/media-key";

test("media keys are user-scoped, deterministic and typed by content", () => {
  const k = mediaKey("sub-123", "evt_9", "snapshot", "image/jpeg");
  assert.equal(k, "users/sub-123/events/evt_9/snapshot/snapshot-evt_9.jpg");
  assert.equal(mediaKey("sub-123", "evt_9", "clip", "video/mp4"), "users/sub-123/events/evt_9/clip/clip-evt_9.mp4");
  assert.equal(mediaKey("sub-123", "evt_9", "snapshot", "image/jpeg"), k, "same event+type → same key (no duplicate uploads)");
  assert.equal(mediaIdFor("evt_9", "clip"), "clip-evt_9");
});

test("identifiers that could escape the user's prefix are rejected", () => {
  for (const bad of ["../x", "a/b", "a..b", "", " ", "-leading", "x".repeat(130)]) assert.equal(isSafeId(bad), false, bad);
  assert.throws(() => mediaKey("sub", "../other", "snapshot", "image/jpeg"));
  assert.throws(() => mediaKey("../root", "evt", "snapshot", "image/jpeg"));
  assert.equal(keyBelongsTo("sub-a", "users/sub-a/events/e/snapshot/snapshot-e.jpg"), true);
  assert.equal(keyBelongsTo("sub-a", "users/sub-b/events/e/snapshot/snapshot-e.jpg"), false);
  assert.equal(keyBelongsTo("sub-a", "users/sub-a/events/../../sub-b/x.jpg"), false);
});

test("content types map to extensions without hardcoding one type", () => {
  assert.equal(extensionFor("image/jpeg"), "jpg");
  assert.equal(extensionFor("image/png"), "png");
  assert.equal(extensionFor("video/mp4; codecs=avc1"), "mp4");
});

test("existing frontend media URLs keep working", () => {
  assert.deepEqual(parseMediaRequest("EVT-42.jpg"), { eventId: "EVT-42", type: "snapshot" });
  assert.deepEqual(parseMediaRequest("EVT-42.mp4"), { eventId: "EVT-42", type: "clip" });
  assert.deepEqual(parseMediaRequest("EVT-42", "video"), { eventId: "EVT-42", type: "clip" });
  assert.equal(parseMediaRequest("../etc/passwd.jpg"), null);
});
