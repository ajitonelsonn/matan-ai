import { getStore, delay, nextId } from "@/lib/mock/store";
import { answer, titleFor } from "@/lib/mock/assistant";
import { ok, badRequest, readJson, notFound } from "@/lib/api/http";
import type { AssistantConversation, AssistantMessage } from "@/lib/types";
import { MOCK_NOW } from "@/lib/mock/clock";
import { answerRing } from "@/lib/ring/assistant";
import { clearChats, deleteChat, getChat, hydrateChats, listChats, saveChat } from "@/lib/ring/assistant-store";
import { AuthRequiredError, authErrorResponse, requireUser, withUser } from "@/lib/auth/server";
import { hydrateUserScope } from "@/lib/auth/scope";

export const dynamic = "force-dynamic";

/**
 * Demo Mode conversations live in the shared in-memory demo store. Real Mode ("ring")
 * conversations belong to the verified Cognito user (DynamoDB CHAT# items) and answers
 * are grounded in that user's Ring data - the two are never mixed.
 */
async function inUserScope<T>(req: Request, fn: () => Promise<T>): Promise<T | Response> {
  try {
    const user = await requireUser(req);
    return await withUser(user, async () => {
      await Promise.all([hydrateUserScope(user), hydrateChats(user.sub)]);
      return fn();
    });
  } catch (e) {
    if (e instanceof AuthRequiredError) return authErrorResponse(e);
    throw e;
  }
}

export async function GET(req: Request) {
  const mode = new URL(req.url).searchParams.get("mode") === "ring" ? "ring" : "demo";
  if (mode === "ring") {
    const r = await inUserScope(req, async () => ok({ conversations: listChats() }));
    return r as Response;
  }
  await delay(200);
  const s = getStore();
  return ok({ conversations: s.conversations.filter((c) => ((c as { mode?: string }).mode ?? "demo") === mode) });
}

export async function POST(req: Request) {
  const body = await readJson<{ conversationId?: string; message: string; mode?: "demo" | "ring" }>(req);
  if (!body.message?.trim()) return badRequest("Message is required");
  const mode = body.mode === "ring" ? "ring" : "demo";

  if (mode === "ring") {
    const r = await inUserScope(req, async () => {
      const now = new Date().toISOString();
      let convo = body.conversationId ? getChat(body.conversationId) : undefined;
      if (!convo) convo = { id: nextId("chat"), title: titleFor(body.message), updatedAt: now, messages: [] };
      const history = convo.messages.slice(-6);
      const userMsg: AssistantMessage = { id: nextId("m"), role: "user", content: body.message.trim(), timestamp: now };
      convo.messages.push(userMsg);
      const reply: AssistantMessage = { id: nextId("m"), role: "assistant", ...(await answerRing(body.message, now, history)) };
      convo.messages.push(reply);
      convo.updatedAt = reply.timestamp;
      if (convo.messages.filter((m) => m.role === "user").length === 1) convo.title = titleFor(body.message);
      await saveChat(convo);
      return ok({ conversation: convo satisfies AssistantConversation, reply });
    });
    return r as Response;
  }

  const s = getStore();
  const now = MOCK_NOW;
  let convo = body.conversationId ? s.conversations.find((c) => c.id === body.conversationId) : undefined;
  if (!convo) {
    convo = { id: nextId("chat"), title: titleFor(body.message), updatedAt: now, messages: [], ...({ mode } as object) } as AssistantConversation;
    s.conversations.unshift(convo);
  }
  const userMsg: AssistantMessage = { id: nextId("m"), role: "user", content: body.message.trim(), timestamp: now };
  convo.messages.push(userMsg);
  // Simulated "thinking" latency for the scripted demo assistant.
  await delay(700 + Math.min(600, body.message.length * 8));
  const reply: AssistantMessage = { id: nextId("m"), role: "assistant", ...answer(body.message, s, now) };
  convo.messages.push(reply);
  convo.updatedAt = now;
  if (convo.messages.filter((m) => m.role === "user").length === 1) convo.title = titleFor(body.message);
  return ok({ conversation: convo satisfies AssistantConversation, reply });
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const mode = url.searchParams.get("mode") === "ring" ? "ring" : "demo";
  if (mode === "ring") {
    const r = await inUserScope(req, async () => {
      if (id) {
        if (!(await deleteChat(id))) return notFound("Conversation not found");
      } else await clearChats();
      return ok({ conversations: listChats() });
    });
    return r as Response;
  }
  const s = getStore();
  if (id) {
    const idx = s.conversations.findIndex((c) => c.id === id);
    if (idx === -1) return notFound("Conversation not found");
    s.conversations.splice(idx, 1);
  } else {
    // Clear only the demo conversations.
    for (let i = s.conversations.length - 1; i >= 0; i--) if (((s.conversations[i] as { mode?: string }).mode ?? "demo") === "demo") s.conversations.splice(i, 1);
  }
  return ok({ conversations: s.conversations.filter((c) => ((c as { mode?: string }).mode ?? "demo") === "demo") });
}
