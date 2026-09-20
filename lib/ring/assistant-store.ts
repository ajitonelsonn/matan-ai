import "server-only";
import type { AssistantConversation } from "@/lib/types";
import { currentUserSub } from "@/lib/auth/server";
import { deleteItem, putItem, queryPrefix, stripKeys, userPK } from "@/lib/aws/dynamodb";

/**
 * Real Mode assistant conversations, per Cognito user: SK=CHAT#{id} in the MatanAI
 * table with an in-memory cache hydrated once per process. Bounded so a conversation
 * item stays far below the DynamoDB item limit.
 */
const chatSK = (id: string) => `CHAT#${id}`;
const MAX_CONVERSATIONS = 30;
const MAX_MESSAGES = 40;

declare global {
  // eslint-disable-next-line no-var
  var __matanChats: Map<string, Map<string, AssistantConversation>> | undefined;
  // eslint-disable-next-line no-var
  var __matanChatsHydrated: Set<string> | undefined;
}
const cache = (sub: string) => {
  const all = (globalThis.__matanChats ??= new Map());
  let m = all.get(sub);
  if (!m) all.set(sub, (m = new Map()));
  return m;
};
const hydrated = () => (globalThis.__matanChatsHydrated ??= new Set());

export async function hydrateChats(sub: string, force = false) {
  if (!force && hydrated().has(sub)) return;
  const items = await queryPrefix<Record<string, unknown>>(userPK(sub), "CHAT#");
  const m = cache(sub);
  m.clear();
  for (const it of items) {
    const c = stripKeys<{ conversation?: AssistantConversation }>(it).conversation;
    if (c?.id) m.set(c.id, c);
  }
  hydrated().add(sub);
  console.info({ event: "dynamodb_hydrated", kind: "chats", count: items.length });
}

export function listChats(): AssistantConversation[] {
  return [...cache(currentUserSub()).values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getChat(id: string): AssistantConversation | undefined {
  return cache(currentUserSub()).get(id);
}

export async function saveChat(convo: AssistantConversation) {
  const sub = currentUserSub();
  if (convo.messages.length > MAX_MESSAGES) convo.messages = convo.messages.slice(-MAX_MESSAGES);
  const m = cache(sub);
  m.set(convo.id, convo);
  await putItem({ PK: userPK(sub), SK: chatSK(convo.id), type: "CHAT", conversation: convo, updatedAt: convo.updatedAt });
  // Keep only the newest conversations.
  const extra = [...m.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(MAX_CONVERSATIONS);
  for (const c of extra) {
    m.delete(c.id);
    await deleteItem(userPK(sub), chatSK(c.id)).catch(() => undefined);
  }
}

export async function deleteChat(id: string): Promise<boolean> {
  const sub = currentUserSub();
  const m = cache(sub);
  if (!m.has(id)) return false;
  m.delete(id);
  await deleteItem(userPK(sub), chatSK(id));
  return true;
}

export async function clearChats() {
  const sub = currentUserSub();
  const m = cache(sub);
  const ids = [...m.keys()];
  m.clear();
  for (const id of ids) await deleteItem(userPK(sub), chatSK(id)).catch(() => undefined);
}
