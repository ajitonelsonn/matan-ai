/** Pure helpers for media identifiers and S3 keys (no AWS imports - unit-testable). */
export type MediaType = "snapshot" | "clip";

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/;

/** Ring event ids / Cognito subs are opaque tokens; reject anything that could alter a key path. */
export function isSafeId(id: string) {
  return SAFE_ID.test(id) && !id.includes("..");
}

export function extensionFor(contentType: string) {
  const ct = contentType.split(";")[0].trim().toLowerCase();
  if (ct === "image/jpeg" || ct === "image/jpg") return "jpg";
  if (ct === "image/png") return "png";
  if (ct === "image/webp") return "webp";
  if (ct === "video/mp4") return "mp4";
  if (ct === "video/quicktime") return "mov";
  return ct.startsWith("video/") ? "bin" : "jpg";
}

/** Deterministic per event + type, so re-analysis overwrites instead of duplicating. */
export function mediaIdFor(eventId: string, type: MediaType) {
  return `${type}-${eventId}`;
}

/** users/{sub}/events/{eventId}/{snapshot|clip}/{mediaId}.{ext} - user segment always from the verified sub. */
export function mediaKey(sub: string, eventId: string, type: MediaType, contentType: string) {
  if (!isSafeId(sub) || !isSafeId(eventId)) throw new Error("Invalid media identifier");
  return `users/${sub}/events/${eventId}/${type}/${mediaIdFor(eventId, type)}.${extensionFor(contentType)}`;
}

/** True only if `key` lives inside this user's prefix (defence in depth on every read). */
export function keyBelongsTo(sub: string, key: string) {
  return isSafeId(sub) && key.startsWith(`users/${sub}/events/`) && !key.includes("..");
}

/** Parse "/api/matan/media/<eventId>.jpg|.mp4" ids from the existing frontend contract. */
export function parseMediaRequest(rawId: string, typeParam?: string | null): { eventId: string; type: MediaType } | null {
  const isVideo = /\.(mp4|mov)$/i.test(rawId) || typeParam === "video" || typeParam === "clip";
  const eventId = rawId.replace(/\.(jpe?g|png|webp|mp4|mov)$/i, "");
  if (!isSafeId(eventId)) return null;
  return { eventId, type: isVideo ? "clip" : "snapshot" };
}
