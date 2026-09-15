"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Plus,
  MessageSquare,
  Trash2,
  Paperclip,
  Mic,
  Send,
  ShieldCheck,
  Zap,
  ChevronRight,
  Search,
  Video,
  Package,
  Shield,
  FileText,
  CircleAlert,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { Topbar } from "@/components/layout/Topbar";
import { useAppData } from "@/components/layout/AppDataProvider";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Toggle } from "@/components/ui/Toggle";
import { Skeleton } from "@/components/ui/Skeleton";
import { SafeImage } from "@/components/ui/SafeImage";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { Icon } from "@/components/ui/Icon";
import { AIMessage, TypingIndicator } from "@/components/matan/AIMessage";
import { NovaBadge } from "@/components/matan/Brand";
import { SectionHeader } from "@/components/matan/SectionHeader";
import { useApi } from "@/hooks/useApi";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { assistantApi } from "@/lib/api/assistant";
import { automationsApi } from "@/lib/api/automations";
import { eventsApi } from "@/lib/api/events";
import { images } from "@/lib/mock/images";
import { MOCK_NOW } from "@/lib/mock/clock";
import { timeAgo } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { toneStyles, type Tone } from "@/lib/utils/tones";
import type { AssistantConversation, AssistantMessage, RingEvent } from "@/lib/types";

const quickAsk = [
  { q: "What happened today?", icon: Search },
  { q: "Show me the front door camera", icon: Video },
  { q: "Summarize unusual activity", icon: CircleAlert },
  { q: "How many deliveries this week?", icon: Package },
  { q: "Is my home safe now?", icon: Shield },
  { q: "Create a weekly report", icon: FileText },
];

const welcome: AssistantMessage = {
  id: "welcome",
  role: "assistant",
  content: "Hello, Ajito! 👋\nI'm Matan AI, your intelligent home assistant. I can help you understand your Ring events, summarize activity, find important moments, and automate actions.",
  timestamp: MOCK_NOW,
  suggestions: ["What happened today?", "Any unusual activity?", "How many deliveries this week?"],
};

export function AssistantPage() {
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const { data: app } = useAppData();
  const isLg = useMediaQuery("(min-width: 1024px)");

  const convosQ = useApi(() => assistantApi.conversations(), []);
  const automationsQ = useApi(() => automationsApi.list(), []);
  const [conversations, setConversations] = React.useState<AssistantConversation[]>([]);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [draftMessages, setDraftMessages] = React.useState<AssistantMessage[]>([]); // for a brand-new chat before the server assigns an id
  const [input, setInput] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [eventMap, setEventMap] = React.useState<Record<string, RingEvent>>({});
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const autoSent = React.useRef(false);

  React.useEffect(() => {
    if (convosQ.data) {
      setConversations(convosQ.data.conversations);
      if (!activeId && !params.get("q") && convosQ.data.conversations[0]) setActiveId(convosQ.data.conversations[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convosQ.data]);

  const active = conversations.find((c) => c.id === activeId) ?? null;
  const messages = active ? active.messages : draftMessages.length ? draftMessages : [welcome];

  // Resolve referenced events for the visible conversation.
  React.useEffect(() => {
    const ids = [...new Set(messages.flatMap((m) => m.relatedEventIds ?? []))].filter((id) => !eventMap[id]);
    if (!ids.length) return;
    eventsApi
      .byIds(ids)
      .then((res) => setEventMap((m) => ({ ...m, ...Object.fromEntries(res.items.map((e) => [e.id, e])) })))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages.length, sending]);

  const send = React.useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || sending) return;
      setInput("");
      setSending(true);
      const optimistic: AssistantMessage = { id: `tmp-${Date.now()}`, role: "user", content: message, timestamp: MOCK_NOW };
      if (active) {
        setConversations((list) => list.map((c) => (c.id === active.id ? { ...c, messages: [...c.messages, optimistic] } : c)));
      } else {
        setDraftMessages((d) => [...d, optimistic]);
      }
      try {
        const res = await assistantApi.send(message, active?.id);
        setConversations((list) => {
          const exists = list.some((c) => c.id === res.conversation.id);
          return exists ? list.map((c) => (c.id === res.conversation.id ? res.conversation : c)) : [res.conversation, ...list];
        });
        setActiveId(res.conversation.id);
        setDraftMessages([]);
      } catch {
        toast.error("Matan couldn't answer right now. Try again.");
        if (active) setConversations((list) => list.map((c) => (c.id === active.id ? { ...c, messages: c.messages.filter((m) => m.id !== optimistic.id) } : c)));
        else setDraftMessages([]);
      } finally {
        setSending(false);
        inputRef.current?.focus();
      }
    },
    [active, sending, toast],
  );

  // Deep-link: /assistant?q=...
  React.useEffect(() => {
    const q = params.get("q");
    if (q && !autoSent.current && !convosQ.loading) {
      autoSent.current = true;
      setActiveId(null);
      window.history.replaceState(null, "", "/assistant");
      void send(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, convosQ.loading]);

  const newChat = () => {
    setActiveId(null);
    setDraftMessages([]);
    setInput("");
    inputRef.current?.focus();
  };

  const clearAll = async () => {
    const ok = await confirm({ title: "Clear all chats?", description: "Your conversation history with Matan AI will be deleted. This can't be undone.", confirmLabel: "Clear all" });
    if (!ok) return;
    try {
      await assistantApi.clear();
      setConversations([]);
      setActiveId(null);
      setDraftMessages([]);
      toast.success("All chats cleared");
    } catch {
      toast.error();
    }
  };

  const deleteChat = async (c: AssistantConversation) => {
    const ok = await confirm({ title: "Delete this chat?", description: `"${c.title}" will be removed.`, confirmLabel: "Delete" });
    if (!ok) return;
    try {
      await assistantApi.clear(c.id);
      setConversations((list) => list.filter((x) => x.id !== c.id));
      if (activeId === c.id) setActiveId(null);
      toast.success("Chat deleted");
    } catch {
      toast.error();
    }
  };

  const toggleAutomation = async (id: string, enabled: boolean) => {
    automationsQ.setData((d) => (d ? { ...d, items: d.items.map((a) => (a.id === id ? { ...a, enabled } : a)) } : d));
    try {
      await automationsApi.update(id, { enabled });
      toast.success(enabled ? "Automation enabled" : "Automation disabled");
    } catch {
      toast.error();
      void automationsQ.refetch({ silent: true });
    }
  };

  const filteredConvos = conversations.filter((c) => c.title.toLowerCase().includes(search.toLowerCase()));
  const sideAutomations = (automationsQ.data?.items ?? []).slice(0, 3);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  };

  return (
    <>
      <Topbar title="AI Assistant" subtitle="Ask anything about your home, business, or Ring devices." search={{ value: search, onChange: setSearch, placeholder: "Search conversations…" }} />

      <div className="grid gap-5 lg:grid-cols-12 xl:min-h-[calc(100dvh-190px)]">
        {/* Recent chats */}
        <aside className="card flex flex-col p-4 lg:col-span-3 xl:col-span-3" aria-label="Recent chats">
          <Button fullWidth leftIcon={<Plus className="size-4" />} onClick={newChat} size="lg">
            New Chat
          </Button>
          <div className="mt-5 mb-2 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-text">Recent Chats</h2>
            <span className="text-xs text-text-3">{conversations.length}</span>
          </div>
          {convosQ.error ? (
            <ErrorState compact onRetry={() => void convosQ.refetch()} />
          ) : convosQ.loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14" />
              ))}
            </div>
          ) : filteredConvos.length === 0 ? (
            <EmptyState compact icon={<MessageSquare />} title={search ? "No matching chats" : "No chats yet"} description={search ? "Try a different search." : "Start a new chat to ask Matan AI about your home."} />
          ) : (
            <ul className={cn("space-y-1.5 overflow-y-auto pr-1", isLg ? "max-h-[calc(100dvh-420px)]" : "max-h-64")}>
              {filteredConvos.map((c) => {
                const isActive = c.id === activeId;
                return (
                  <li key={c.id} className="group relative">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveId(c.id);
                        setDraftMessages([]);
                      }}
                      aria-current={isActive ? "true" : undefined}
                      className={cn(
                        "flex w-full items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-[background-color,border-color]",
                        isActive ? "border-primary/50 bg-primary/10" : "border-border bg-bg/30 hover:border-border-strong hover:bg-surface-2/60",
                      )}
                    >
                      <MessageSquare className={cn("mt-0.5 size-4 shrink-0", isActive ? "text-primary" : "text-text-3")} aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-medium text-text">{c.title}</span>
                        <span className="block text-[11.5px] text-text-3">{timeAgo(c.updatedAt)}</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete chat ${c.title}`}
                      onClick={() => void deleteChat(c)}
                      className="absolute right-2 top-2 hidden size-7 items-center justify-center rounded-md text-text-3 hover:bg-danger/15 hover:text-danger group-hover:inline-flex focus-visible:inline-flex"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="mt-auto pt-4">
            <Button variant="outline" fullWidth leftIcon={<Trash2 className="size-4" />} onClick={() => void clearAll()} disabled={!conversations.length}>
              Clear all chats
            </Button>
          </div>
        </aside>

        {/* Conversation */}
        <section className="card flex min-h-[560px] flex-col p-4 sm:p-5 lg:col-span-9 xl:col-span-6" aria-label="Conversation">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-[15px] font-semibold text-text">{active?.title ?? "New chat"}</h2>
              <p className="text-[12px] text-text-3">Answers are grounded in your Ring events, devices and family data.</p>
            </div>
            <NovaBadge />
          </div>
          <div className="flex-1 space-y-5 overflow-y-auto px-1 py-2" role="log" aria-live="polite">
            {messages.map((m) => (
              <AIMessage
                key={m.id}
                message={m}
                user={app?.user}
                events={eventMap}
                onSuggestion={(s) => void send(s)}
                onOpenEvent={(id) => router.push(`/events/${id}`)}
                onFeedback={(k) => toast.success(k === "up" ? "Thanks for the feedback" : "Thanks - we'll improve this answer")}
                onCopy={() => {
                  void navigator.clipboard?.writeText(m.content).catch(() => undefined);
                  toast.success("Copied to clipboard");
                }}
              />
            ))}
            {sending && <TypingIndicator />}
            <div ref={bottomRef} />
          </div>
          <form
            className="mt-3 flex items-end gap-2 rounded-2xl border border-primary/40 bg-bg/50 p-1.5 transition-[border-color,box-shadow] focus-within:border-primary/70 focus-within:shadow-[0_0_0_3px_rgba(18,168,255,0.15)]"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <IconButton label="Attach a file" variant="ghost" type="button" onClick={() => toast.info("Attachments aren't available in this preview")} className="rounded-xl">
              <Paperclip />
            </IconButton>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              placeholder="Ask Matan AI anything…"
              aria-label="Message Matan AI"
              className="max-h-32 min-h-10 flex-1 resize-none bg-transparent px-2 py-2.5 text-sm text-text placeholder:text-text-3 outline-none"
            />
            <IconButton label="Voice input" variant="ghost" type="button" onClick={() => toast.info("Voice input isn't available in this preview")} className="rounded-xl">
              <Mic />
            </IconButton>
            <IconButton label="Send message" variant="primary" type="submit" disabled={!input.trim() || sending} className="rounded-xl">
              <Send />
            </IconButton>
          </form>
          <p className="mt-2 text-center text-[11.5px] text-text-3">Matan AI can make mistakes. Always verify important information.</p>
        </section>

        {/* Right rail */}
        <aside className="space-y-4 lg:col-span-12 xl:col-span-3" aria-label="Context">
          <Link href="/security-modes" className="card flex items-center gap-3.5 p-4 transition-[border-color,transform] hover:-translate-y-0.5 hover:border-border-strong">
            <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl border border-success/30 bg-success/12 text-success">
              <ShieldCheck className="size-6" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold text-text">Home Status</span>
              <span className="block text-[17px] font-semibold text-success leading-tight">Protected</span>
              <span className="block text-[12.5px] text-text-3">{app ? `${app.activeModeName} · ${app.devices.filter((d) => d.status === "online").length}/${app.devices.length} devices online` : "All systems active"}</span>
            </span>
            <ChevronRight className="size-5 text-text-3" aria-hidden />
          </Link>

          <section className="card p-4" aria-labelledby="quick-ask">
            <SectionHeader icon={<Zap />} title={<span id="quick-ask">Quick Ask</span>} subtitle="Try these common questions" iconTone="warning" className="mb-3" />
            <ul className="space-y-1.5">
              {quickAsk.map(({ q, icon: QIcon }) => (
                <li key={q}>
                  <button
                    type="button"
                    onClick={() => void send(q)}
                    disabled={sending}
                    className="group flex w-full items-center gap-2.5 rounded-xl border border-border bg-bg/30 px-3 py-2.5 text-left text-[13.5px] font-medium text-text transition-[border-color,background-color] hover:border-border-strong hover:bg-surface-2/70 disabled:opacity-60"
                  >
                    <QIcon className="size-4 shrink-0 text-primary" aria-hidden />
                    <span className="flex-1 truncate">{q}</span>
                    <ChevronRight className="size-4 text-text-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="card p-4" aria-labelledby="automations-rail">
            <SectionHeader icon={<Zap />} title={<span id="automations-rail">Automations</span>} subtitle="Manage AI-powered actions" href="/automations" iconTone="warning" className="mb-3" />
            {automationsQ.loading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            ) : (
              <ul className="space-y-1.5">
                {sideAutomations.map((a) => {
                  const t = toneStyles[a.tone as Tone];
                  return (
                    <li key={a.id} className="flex items-center gap-2.5 rounded-xl border border-border bg-bg/30 px-3 py-2">
                      <span className={cn("inline-flex size-8 shrink-0 items-center justify-center rounded-lg border", t.bg, t.border, t.text)}>
                        <Icon name={a.icon} className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-text">{a.name}</span>
                      <Toggle checked={a.enabled} onChange={(v) => void toggleAutomation(a.id, v)} size="sm" label={`Toggle ${a.name}`} />
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <div className="relative overflow-hidden rounded-card border border-border min-h-[128px]">
            <SafeImage src={images.hills} alt="" sizes="360px" />
            <div className="absolute inset-0 bg-gradient-to-r from-bg/95 via-bg/70 to-bg/20" aria-hidden />
            <div className="relative p-5">
              <p className="text-[18px] font-semibold leading-snug text-text">
                Smarter homes
                <br />
                for a brighter Timor-Leste.
              </p>
              <p className="mt-1.5 text-[13px] text-text-2">Matan AI</p>
              <Link href="/care" className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-semibold text-primary hover:text-primary-2">
                Care & Family <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
