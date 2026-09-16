import { request, qs } from "./client";
import type { AssistantConversation, AssistantMessage } from "@/lib/types";

export const assistantApi = {
  conversations: (mode: "demo" | "ring" = "demo") => request<{ conversations: AssistantConversation[] }>(`/api/assistant${qs({ mode })}`),
  send: (message: string, conversationId?: string, mode: "demo" | "ring" = "demo") =>
    request<{ conversation: AssistantConversation; reply: AssistantMessage }>("/api/assistant", {
      method: "POST",
      json: { message, conversationId, mode },
    }),
  clear: (id?: string) => request<{ conversations: AssistantConversation[] }>(`/api/assistant${qs({ id })}`, { method: "DELETE" }),
};
