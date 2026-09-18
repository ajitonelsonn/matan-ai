import { getStore, delay, nextId } from "@/lib/mock/store";
import { answer, titleFor } from "@/lib/mock/assistant";
import { ok, badRequest, readJson, notFound } from "@/lib/api/http";
import type { AssistantConversation, AssistantMessage } from "@/lib/types";
import { MOCK_NOW } from "@/lib/mock/clock";
import { answerRing } from "@/lib/ring/assistant";
import { AuthRequiredError, authErrorResponse, requireUser, withUser } from "@/lib/auth/server";
import { hydrateUserScope } from "@/lib/auth/scope";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  await delay(200);
  const mode = new URL(req.url).searchParams.get("mode") === "ring" ? "ring" : "demo";
  const s = getStore();
  // Conversations are kept per mode so Demo and Ring answers are never mixed.
  return ok({ conversations: s.conversations.filter((c) => ((c as { mode?: string }).mode ?? "demo") === mode) });
}

export async function POST(req: Request) {
  const body = await readJson<{ conversationId?: string; message: string; mode?: "demo" | "ring" }>(req);
  if (!body.message?.trim()) return badRequest("Message is required");
  const s = getStore();
  const mode = body.mode === "ring" ? "ring" : "demo";
  const now = mode === "ring" ? new Date().toISOString() : MOCK_NOW;
  let convo = body.conversationId ? s.conversations.find((c) => c.id === body.conversationId) : undefined;
  if (!convo) {
    convo = { id: nextId("chat"), title: titleFor(body.message), updatedAt: now, messages: [], ...({ mode } as object) } as AssistantConversation;
    s.conversations.unshift(convo);
  }
  const userMsg: AssistantMessage = { id: nextId("m"), role: "user", content: body.message.trim(), timestamp: now };
  convo.messages.push(userMsg);
  // Simulated "thinking" latency.
  await delay(mode === "ring" ? 300 : 700 + Math.min(600, body.message.length * 8));
  // Real Mode answers read the signed-in user's Ring data, so they need the verified Cognito identity.
  let ringAnswer: Omit<AssistantMessage, "id" | "role"> | null = null;
  if (mode === "ring") {
    try {
      const user = await requireUser(req);
      ringAnswer = await withUser(user, async () => {
        await hydrateUserScope(user);
        return answerRing(body.message, now);
      });
    } catch (e) {
      if (e instanceof AuthRequiredError) return authErrorResponse(e);
      throw e;
    }
  }
  const reply: AssistantMessage = { id: nextId("m"), role: "assistant", ...(ringAnswer ?? answer(body.message, s, now)) };
  convo.messages.push(reply);
  convo.updatedAt = now;
  if (convo.messages.filter((m) => m.role === "user").length === 1) convo.title = titleFor(body.message);
  return ok({ conversation: convo satisfies AssistantConversation, reply });
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const s = getStore();
  if (id) {
    const idx = s.conversations.findIndex((c) => c.id === id);
    if (idx === -1) return notFound("Conversation not found");
    s.conversations.splice(idx, 1);
  } else {
    s.conversations.splice(0, s.conversations.length);
  }
  return ok({ conversations: s.conversations });
}
