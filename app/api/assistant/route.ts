import { getStore, delay, nextId } from "@/lib/mock/store";
import { answer, titleFor } from "@/lib/mock/assistant";
import { ok, badRequest, readJson, notFound } from "@/lib/api/http";
import type { AssistantConversation, AssistantMessage } from "@/lib/types";
import { MOCK_NOW } from "@/lib/mock/clock";

export const dynamic = "force-dynamic";

export async function GET() {
  await delay(200);
  const s = getStore();
  return ok({ conversations: s.conversations });
}

export async function POST(req: Request) {
  const body = await readJson<{ conversationId?: string; message: string }>(req);
  if (!body.message?.trim()) return badRequest("Message is required");
  const s = getStore();
  const now = MOCK_NOW;
  let convo = body.conversationId ? s.conversations.find((c) => c.id === body.conversationId) : undefined;
  if (!convo) {
    convo = { id: nextId("chat"), title: titleFor(body.message), updatedAt: now, messages: [] };
    s.conversations.unshift(convo);
  }
  const userMsg: AssistantMessage = { id: nextId("m"), role: "user", content: body.message.trim(), timestamp: now };
  convo.messages.push(userMsg);
  // Simulated "thinking" latency.
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
