import type { MatanEventIntelligence } from "./schema";

/** Persistence boundary. In-memory now; DynamoDB-backed later without UI changes. */
export interface MatanIntelligenceStore {
  get(eventId: string): Promise<MatanEventIntelligence | null>;
  save(eventId: string, intelligence: MatanEventIntelligence): Promise<void>;
  all(): Promise<Record<string, MatanEventIntelligence>>;
}

declare global {
  // eslint-disable-next-line no-var
  var __matanIntelligence: Map<string, MatanEventIntelligence> | undefined;
}

function map() {
  if (!globalThis.__matanIntelligence) globalThis.__matanIntelligence = new Map();
  return globalThis.__matanIntelligence;
}

export const memoryIntelligenceStore: MatanIntelligenceStore = {
  async get(eventId) {
    return map().get(eventId) ?? null;
  },
  async save(eventId, intelligence) {
    map().set(eventId, intelligence);
  },
  async all() {
    return Object.fromEntries(map());
  },
};

/** Synchronous read used by the Ring read model when merging intelligence into events. */
export function getIntelligenceSync(eventId: string) {
  return map().get(eventId) ?? null;
}

/** In-flight guard so a double click never triggers two Bedrock invocations. */
const inFlight = new Set<string>();
export function beginAnalysis(eventId: string) {
  if (inFlight.has(eventId)) return false;
  inFlight.add(eventId);
  return true;
}
export function endAnalysis(eventId: string) {
  inFlight.delete(eventId);
}
export function isAnalyzing(eventId: string) {
  return inFlight.has(eventId);
}

/* ---- Event media (snapshots fetched server-side from Ring) ---------------- */

export interface StoredMedia {
  bytes: Uint8Array;
  contentType: string;
  capturedAt?: string;
  savedAt: string;
  /** For clips: actual length in ms as reported by Ring. */
  lengthMs?: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __matanMedia: Map<string, StoredMedia> | undefined;
}

const MAX_MEDIA_ITEMS = 60;

function mediaMap() {
  if (!globalThis.__matanMedia) globalThis.__matanMedia = new Map();
  return globalThis.__matanMedia;
}

/** Keep the snapshot so the UI can show what Matan AI actually looked at. In-memory, bounded. */
const mediaKey = (eventId: string, type: "image" | "video") => `${type}:${eventId}`;

export function saveMedia(eventId: string, media: Omit<StoredMedia, "savedAt">, type: "image" | "video" = "image") {
  const m = mediaMap();
  if (m.size >= MAX_MEDIA_ITEMS) {
    const oldest = m.keys().next().value;
    if (oldest) m.delete(oldest);
  }
  m.set(mediaKey(eventId, type), { ...media, savedAt: new Date().toISOString() });
}

export function getMedia(eventId: string, type: "image" | "video" = "image") {
  return mediaMap().get(mediaKey(eventId, type)) ?? null;
}

export function hasMediaSync(eventId: string, type: "image" | "video" = "image") {
  return mediaMap().has(mediaKey(eventId, type));
}
