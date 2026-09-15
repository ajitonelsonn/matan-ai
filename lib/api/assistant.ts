import { request, qs } from "./client";
import type { AssistantConversation, AssistantMessage } from "@/lib/types";

export const assistantApi = {
  conversations: () => request<{ conversations: AssistantConversation[] }>("/api/assistant"),
  send: (message: string, conversationId?: string) =>
    request<{ conversation: AssistantConversation; reply: AssistantMessage }>("/api/assistant", {
      method: "POST",
      json: { message, conversationId },
    }),
  clear: (id?: string) => request<{ conversations: AssistantConversation[] }>(`/api/assistant${qs({ id })}`, { method: "DELETE" }),
};
