import "server-only";
import { currentUser, currentUserSub } from "@/lib/auth/server";
import { getItem, putItem, queryPrefix, deleteItem as deleteDynamoItem, userPK } from "@/lib/aws/dynamodb";
import { deleteObject, getObjectStream, isS3Configured, putObject, S3Error, type S3ObjectStream } from "@/lib/aws/s3";
import { keyBelongsTo, mediaIdFor, mediaKey, type MediaType } from "./media-key";

/**
 * Media store: Ring snapshot/clip bytes → private S3, metadata → DynamoDB
 * (PK=USER#{sub}, SK=MEDIA#{eventId}), per-user metadata cache for sync lookups.
 *
 *   Ring integration → putMedia() → S3 PutObject → confirm → DynamoDB metadata
 *   /api/matan/media/:id → getMediaStream() → ownership via the user's partition → S3 GetObject
 *
 * Without S3_MEDIA_BUCKET (local dev, tests) it falls back to the previous bounded
 * process-memory behaviour so Demo/Real mode keep working.
 */
export interface MediaMeta {
  mediaId: string;
  type: MediaType;
  contentType: string;
  s3Key: string;
  size: number;
  createdAt: string;
  /** Ring capture timestamp (ISO). */
  capturedAt?: string;
  /** For clips: actual length in ms as reported by Ring. */
  lengthMs?: number;
}

interface MediaRecord {
  eventId: string;
  media: Partial<Record<MediaType, MediaMeta>>;
}

type MediaItem = MediaRecord & { PK: string; SK: string; type: "MEDIA" };

const mediaSK = (eventId: string) => `MEDIA#${eventId}`;

declare global {
  // eslint-disable-next-line no-var
  var __matanMediaMeta: Map<string, Map<string, MediaRecord>> | undefined;
  // eslint-disable-next-line no-var
  var __matanMediaMetaHydrated: Set<string> | undefined;
  // eslint-disable-next-line no-var
  var __matanMediaMemory: Map<string, MemoryMedia> | undefined;
}

function metaCache(sub: string) {
  if (!globalThis.__matanMediaMeta) globalThis.__matanMediaMeta = new Map();
  let m = globalThis.__matanMediaMeta.get(sub);
  if (!m) {
    m = new Map();
    globalThis.__matanMediaMeta.set(sub, m);
  }
  return m;
}

function hydrated() {
  if (!globalThis.__matanMediaMetaHydrated) globalThis.__matanMediaMetaHydrated = new Set();
  return globalThis.__matanMediaMetaHydrated;
}

/** Load the user's media metadata into the cache (once per process). */
export async function hydrateMedia(sub: string, force = false) {
  if (!isS3Configured()) return;
  if (!force && hydrated().has(sub)) return;
  const items = await queryPrefix<MediaItem>(userPK(sub), "MEDIA#");
  const m = metaCache(sub);
  for (const it of items) if (it.eventId && it.media) m.set(it.eventId, { eventId: it.eventId, media: it.media });
  hydrated().add(sub);
  console.info({ event: "dynamodb_hydrated", kind: "media", count: items.length });
}

/* ---- Memory fallback (no bucket configured) ------------------------------ */

interface MemoryMedia {
  bytes: Uint8Array;
  contentType: string;
  capturedAt?: string;
  lengthMs?: number;
}
const MAX_MEMORY_ITEMS = 60;
function memory() {
  if (!globalThis.__matanMediaMemory) globalThis.__matanMediaMemory = new Map();
  return globalThis.__matanMediaMemory;
}
const memKey = (sub: string, eventId: string, type: MediaType) => `${sub}:${type}:${eventId}`;

/* ---- Public API ------------------------------------------------------------ */

export interface MediaInput {
  bytes: Uint8Array;
  contentType: string;
  capturedAt?: string;
  lengthMs?: number;
}

/**
 * Upload media for one of the current user's events. Order: PutObject → confirmed → metadata,
 * so DynamoDB never references an object that wasn't uploaded. Deterministic key per (event, type).
 */
export async function putMedia(eventId: string, type: MediaType, input: MediaInput): Promise<MediaMeta | null> {
  const sub = currentUserSub();
  if (!isS3Configured()) {
    const m = memory();
    if (m.size >= MAX_MEMORY_ITEMS) {
      const oldest = m.keys().next().value;
      if (oldest) m.delete(oldest);
    }
    m.set(memKey(sub, eventId, type), { bytes: input.bytes, contentType: input.contentType, capturedAt: input.capturedAt, lengthMs: input.lengthMs });
    return null;
  }
  const key = mediaKey(sub, eventId, type, input.contentType);
  try {
    await putObject(key, input.bytes, input.contentType, { eventid: eventId, mediatype: type });
  } catch (e) {
    console.error({ event: "media_upload_failed", eventId, type, code: (e as S3Error)?.code ?? "error" });
    throw e;
  }
  const meta: MediaMeta = { mediaId: mediaIdFor(eventId, type), type, contentType: input.contentType, s3Key: key, size: input.bytes.byteLength, createdAt: new Date().toISOString(), capturedAt: input.capturedAt, lengthMs: input.lengthMs };
  const record: MediaRecord = { eventId, media: { ...(metaCache(sub).get(eventId)?.media ?? {}), [type]: meta } };
  await putItem({ PK: userPK(sub), SK: mediaSK(eventId), type: "MEDIA", ...record });
  metaCache(sub).set(eventId, record);
  console.info({ event: "media_persisted", eventId, type, size: meta.size });
  return meta;
}

/** Metadata for the current user's event media (cache first, then DynamoDB). */
export async function getMediaMeta(eventId: string, type: MediaType): Promise<MediaMeta | null> {
  const sub = currentUserSub();
  const cached = metaCache(sub).get(eventId)?.media[type];
  if (cached) return cached;
  const item = await getItem<MediaItem>(userPK(sub), mediaSK(eventId));
  if (item?.media) metaCache(sub).set(eventId, { eventId, media: item.media });
  return item?.media?.[type] ?? null;
}

/** Synchronous metadata read from the per-user cache (timeline timestamps). */
export function getMediaMetaSync(eventId: string, type: MediaType = "snapshot"): MediaMeta | null {
  const u = currentUser();
  if (!u || !isS3Configured()) return null;
  return metaCache(u.sub).get(eventId)?.media[type] ?? null;
}

/** Synchronous "does media exist" for the read model (URL construction). */
export function hasMediaSync(eventId: string, type: MediaType = "snapshot") {
  const u = currentUser();
  if (!u) return false;
  if (!isS3Configured()) return memory().has(memKey(u.sub, eventId, type));
  return Boolean(metaCache(u.sub).get(eventId)?.media[type]);
}

export interface MediaResponse {
  body: ReadableStream<Uint8Array> | Uint8Array;
  contentType: string;
  contentLength?: number;
  capturedAt?: string;
}

/**
 * Resolve media through the *current user's* partition, verify the stored key sits
 * under that user's prefix, then read from S3. The client only ever supplies the event id.
 */
export async function getMediaStream(eventId: string, type: MediaType): Promise<MediaResponse> {
  const sub = currentUserSub();
  if (!isS3Configured()) {
    const mem = memory().get(memKey(sub, eventId, type));
    if (!mem) throw new S3Error("MEDIA_NOT_FOUND", "Media not found.", 404);
    return { body: mem.bytes, contentType: mem.contentType, contentLength: mem.bytes.byteLength, capturedAt: mem.capturedAt };
  }
  const meta = await getMediaMeta(eventId, type);
  if (!meta || !keyBelongsTo(sub, meta.s3Key)) throw new S3Error("MEDIA_NOT_FOUND", "Media not found.", 404);
  const obj: S3ObjectStream = await getObjectStream(meta.s3Key);
  return { body: obj.stream, contentType: obj.contentType ?? meta.contentType, contentLength: obj.contentLength ?? meta.size, capturedAt: meta.capturedAt };
}

/** Remove all media objects + metadata for one of the current user's events. */
export async function deleteMedia(eventId: string) {
  const sub = currentUserSub();
  if (!isS3Configured()) {
    memory().delete(memKey(sub, eventId, "snapshot"));
    memory().delete(memKey(sub, eventId, "clip"));
    return;
  }
  const record = metaCache(sub).get(eventId) ?? (await getItem<MediaItem>(userPK(sub), mediaSK(eventId)));
  for (const meta of Object.values(record?.media ?? {})) if (meta && keyBelongsTo(sub, meta.s3Key)) await deleteObject(meta.s3Key);
  await deleteDynamoItem(userPK(sub), mediaSK(eventId));
  metaCache(sub).delete(eventId);
}

