"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Trash2, MessageSquare, Paperclip, Mic, Send, ShieldCheck, ChevronRight, Zap, Search, Video, Activity, Package, Shield, FileText, ArrowRight } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { useAppData } from "@/components/layout/AppDataProvider";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Toggle } from "@/components/ui/Toggle";
import { Menu } from "@/components/ui/Menu";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { SafeImage } from "@/components/ui/SafeImage";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { Icon } from "@/components/ui/Icon";
import { AIMessage, TypingIndicator } from "@/components/matan/AIMessage";
import { NovaBadge } from "@/components/matan/Brand";
import { SectionHeader } from "@/components/matan/SectionHeader";
import { LoadingOverlay } from "@/components/matan/MatanLoader";
import { useApi } from "@/hooks/useApi";
import { assistantApi } from "@/lib/api/assistant";
import { eventsApi } from "@/lib/api/events";
import { automationsApi } from "@/lib/api/automations";
import { images } from "@/lib/mock/images";
import { MOCK_NOW } from "@/lib/mock/clock";
import { timeAgo } from "@/lib/utils/format";
import { toneStyles, type Tone } from "@/lib/utils/tones";
import { cn } from "@/lib/utils/cn";
import type { AssistantConversation, AssistantMessage, RingEvent } from "@/lib/types";

const quickAsk = [
  { q: "What happened today?", icon: Search },
  { q: "Show me the front door camera", icon: Video },
  { q: "Summarize unusual activity", icon: Activity },
  { q: "How many deliveries this week?", icon: Package },
  { q: "Is my home safe now?", icon: Shield },
  { q: "Create a weekly report", icon: FileText },
];

const greeting = (name: string): AssistantMessage => ({
  id: "greeting",
  role: "assistant",
  content: `Hello, ${name}! 👋\nI'm Matan AI, your intelligent home assistant. I can help you understand your Ring events, summarize activity, find important moments, and automate actions.`,
  timestamp: MOCK_NOW,
  suggestions: ["What happened today?", "Is my home safe now?", "How many deliveries this week?"],
});

export function AssistantPage() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const confirm = useConfirm();
  const { data: shell } = useAppData();
  const firstName = shell?.user.firstName ?? "Ajito";

  const convQ = useApi(() => assistantApi.conversations(), []);
  const eventsQ = useApi(() => eventsApi.list({ range: "30d", pageSize: 400 }), []);
  const autoQ = useApi(() => automationsApi.list(), []);
  const eventMap = React.useMemo(() => Object.fromEntries((eventsQ.data?.items ?? []).map((e) => [e.id, e])) as Record<string, RingEvent>, [eventsQ.data]);

  const [conversations, setConversations] = React.useState<AssistantConversation[]>([]);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<AssistantMessage[] | null>(null); // "new chat" before the API creates it
  const [input, setInput] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const textRef = React.useRef<HTMLTextAreaElement>(null);
  const autoSent = React.useRef(false);

  React.useEffect(() => {
    if (!convQ.data) return;
    setConversations(convQ.data.conversations);
    if (!activeId && !draft && convQ.data.conversations[0] && !params.get("q")) setActiveId(convQ.data.conversations[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convQ.data]);

  const active = conversations.find((c) => c.id === activeId) ?? null;
  const messages = draft ?? active?.messages ?? [];

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, sending]);

  const newChat = React.useCallback(() => {
    setActiveId(null);
    setDraft([greeting(firstName)]);
    setInput("");
    requestAnimationFrame(() => textRef.current?.focus());
  }, [firstName]);

  const send = React.useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || sending) return;
      setInput("");
      setSending(true);
      const optimistic: AssistantMessage = { id: `tmp-${Date.now()}`, role: "user", content: message, timestamp: MOCK_NOW };
      if (draft || !activeId) setDraft((d) => [...(d ?? [greeting(firstName)]), optimistic]);
      else setConversations((list) => list.map((c) => (c.id === activeId ? { ...c, messages: [...c.messages, optimistic] } : c)));
      try {
        const { conversation } = await assistantApi.send(message, activeId ?? undefined);
        setConversations((list) => {
          const exists = list.some((c) => c.id === conversation.id);
          const next = exists ? list.map((c) => (c.id === conversation.id ? conversation : c)) : [conversation, ...list];
          return next;
        });
        setActiveId(conversation.id);
        setDraft(null);
      } catch {
        toast.error("Matan couldn't answer right now. Try again.");
      } finally {
        setSending(false);
      }
    },
    [activeId, draft, firstName, sending, toast],
  );

  // Deep link: /assistant?q=... starts a new chat and sends the question.
  React.useEffect(() => {
    const q = params.get("q");
    if (q && !autoSent.current && convQ.data) {
      autoSent.current = true;
      setDraft([greeting(firstName)]);
      setActiveId(null);
      void send(q);
      window.history.replaceState(null, "", "/assistant");
    }
  }, [params, convQ.data, firstName, send]);

  const clearAll = async () => {
    const ok = await confirm({ title: "Clear all chats?", description: "Your conversation history with Matan AI will be deleted. Your events and settings are not affected.", confirmLabel: "Clear all" });
    if (!ok) return;
    try {
      await assistantApi.clear();
      setConversations([]);
      newChat();
      toast.success("All chats cleared");
    } catch {
      toast.error();
    }
  };

  const deleteChat = async (id: string) => {
    const ok = await confirm({ title: "Delete this chat?", confirmLabel: "Delete" });
    if (!ok) return;
    try {
      await assistantApi.clear(id);
      setConversations((list) => list.filter((c) => c.id !== id));
      if (activeId === id) newChat();
      toast.success("Chat deleted");
    } catch {
      toast.error();
    }
  };

  const toggleAutomation = async (id: string, enabled: boolean) => {
    try {
      const updated = await automationsApi.update(id, { enabled });
      autoQ.setData((d) => (d ? { ...d, items: d.items.map((a) => (a.id === id ? updated : a)) } : d));
      toast.success(enabled ? "Automation enabled" : "Automation disabled", updated.name);
    } catch {
      toast.error();
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  };

  const filtered = conversations.filter((c) => c.title.toLowerCase().includes(search.toLowerCase()));
  const online = shell ? shell.devices.filter((d) => d.status === "online").length : 0;
  const importantOpen = shell?.todayCounts.important ?? 0;

  return (
    <>
      <Topbar title="AI Assistant" subtitle="Ask anything about your home, business, or Ring devices." search={{ value: search, onChange: setSearch, placeholder: "Search conversations…" }} />

      <div className="grid gap-5 xl:grid-cols-12 min-h-[calc(100dvh-200px)]">
        {/* Recent chats */}
        <aside className="card flex flex-col p-4 xl:col-span-3 max-h-[70vh] xl:max-h-none">
          <Button fullWidth leftIcon={<Plus className="size-4" />} onClick={newChat} size="lg">
            New Chat
          </Button>
          <div className="mt-5 mb-2 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-text">Recent Chats</h2>
            <span className="text-xs text-text-3">{conversations.length}</span>
          </div>
          <div className="relative flex-1 min-h-[160px] overflow-y-auto -mx-1 px-1">
            {convQ.loading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-14" />
                ))}
                <LoadingOverlay size="sm" />
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState compact icon={<MessageSquare />} title={search ? "No matching chats" : "No chats yet"} description={search ? "Try a different search." : "Start a new chat to ask Matan AI about your home."} />
            ) : (
              <ul className="space-y-1.5">
                {filtered.map((c) => {
                  const isActive = c.id === activeId && !draft;
                  return (
                    <li key={c.id} className="group relative">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveId(c.id);
                          setDraft(null);
                        }}
                        aria-current={isActive ? "true" : undefined}
                        className={cn(
                          "flex w-full items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-[background-color,border-color]",
                          isActive ? "border-primary/50 bg-primary/10 glow" : "border-border bg-surface-2/40 hover:border-border-strong hover:bg-surface-2/80",
                        )}
                      >
                        <MessageSquare className={cn("mt-0.5 size-4 shrink-0", isActive ? "text-primary" : "text-text-3")} aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13.5px] font-medium text-text">{c.title}</span>
                          <span className="block text-[11.5px] text-text-3">{timeAgo(c.updatedAt)}</span>
                        </span>
                      </button>
                      <div className="absolute right-1.5 top-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                        <Menu triggerSize="sm" triggerVariant="ghost" label="Chat options" items={[{ label: "Delete chat", icon: <Trash2 />, tone: "danger", onSelect: () => void deleteChat(c.id) }]} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <Button variant="outline" fullWidth className="mt-4" leftIcon={<Trash2 className="size-4" />} onClick={() => void clearAll()} disabled={!conversations.length}>
            Clear all chats
          </Button>
        </aside>

        {/* Conversation */}
        <section className="card relative flex flex-col p-4 sm:p-5 xl:col-span-6 min-h-[560px]" aria-label="Conversation">
          <div className="absolute right-4 top-4 z-10">
            <NovaBadge />
          </div>
          <div className="flex-1 overflow-y-auto pr-1 pt-14 space-y-5">
            {convQ.error ? (
              <ErrorState onRetry={() => void convQ.refetch()} message={convQ.error} compact />
            ) : convQ.loading && !messages.length ? (
              <div className="relative min-h-[320px]">
                <LoadingOverlay label="Loading conversation" />
              </div>
            ) : (
              <>
                {messages.map((m) => (
                  <AIMessage
                    key={m.id}
                    message={m}
                    user={shell?.user}
                    events={eventMap}
                    onSuggestion={(s) => void send(s)}
                    onOpenEvent={(id) => router.push(`/events/${id}`)}
                    onFeedback={(k) => toast.success(k === "up" ? "Thanks for the feedback" : "Thanks — Matan will learn from this")}
                    onCopy={() => {
                      void navigator.clipboard?.writeText(m.content);
                      toast.success("Copied to clipboard");
                    }}
                  />
                ))}
                {sending && <TypingIndicator />}
                <div ref={bottomRef} />
              </>
            )}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
            className="mt-4 flex items-end gap-2 rounded-2xl border border-primary/40 bg-bg/50 p-2 transition-[border-color,box-shadow] focus-within:border-primary/70 focus-within:shadow-[0_0_0_3px_rgba(18,168,255,0.15)]"
          >
            <IconButton label="Attach" type="button" onClick={() => toast.info("Attachments aren't available in this preview")}>
              <Paperclip />
            </IconButton>
            <textarea
              ref={textRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
              rows={1}
              placeholder="Ask Matan AI anything…"
              aria-label="Message Matan AI"
              className="max-h-32 min-h-10 flex-1 resize-none bg-transparent px-2 py-2.5 text-[14.5px] text-text placeholder:text-text-3 outline-none"
            />
            <IconButton label="Voice input" type="button" variant="primary" className="rounded-xl" onClick={() => toast.info("Voice input isn't available in this preview")}>
              <Mic />
            </IconButton>
            <IconButton label="Send message" type="submit" variant="primary" className="rounded-xl" disabled={!input.trim() || sending}>
              <Send />
            </IconButton>
          </form>
          <p className="mt-2 text-center text-[11.5px] text-text-3">Matan AI can make mistakes. Always verify important information.</p>
        </section>

        {/* Right rail */}
        <div className="space-y-5 xl:col-span-3">
          <button type="button" onClick={() => router.push("/security-modes")} className="card flex w-full items-center gap-3.5 p-4 text-left transition-[border-color] hover:border-border-strong">
            <span className={cn("inline-flex size-12 shrink-0 items-center justify-center rounded-2xl border", importantOpen ? "bg-warning/12 border-warning/25 text-warning" : "bg-success/12 border-success/25 text-success")}>
              <ShieldCheck className="size-6" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold text-text">Home Status</span>
              <span className={cn("block text-[17px] font-bold", importantOpen ? "text-warning" : "text-success")}>{importantOpen ? "Protected · review" : "Protected"}</span>
              <span className="block text-[12.5px] text-text-3">
                {shell ? `${shell.activeModeName} · ${online}/${shell.devices.length} devices online` : "All systems active"}
              </span>
            </span>
            <ChevronRight className="size-4 text-text-3" aria-hidden />
          </button>

          <section className="card p-4" aria-labelledby="quick-ask">
            <SectionHeader icon={<Zap />} title={<span id="quick-ask">Quick Ask</span>} subtitle="Try these common questions" iconTone="warning" />
            <ul className="space-y-2">
              {quickAsk.map(({ q, icon: I }) => (
                <li key={q}>
                  <button type="button" onClick={() => void send(q)} disabled={sending} className="card-inset flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13.5px] font-medium text-text transition-[border-color,background-color] hover:border-border-strong hover:bg-surface-2/70 disabled:opacity-60">
                    <I className="size-4 shrink-0 text-primary" aria-hidden />
                    <span className="flex-1 truncate">{q}</span>
                    <ChevronRight className="size-4 text-text-3" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="card p-4" aria-labelledby="auto-title">
            <SectionHeader icon={<Zap />} title={<span id="auto-title">Automations</span>} subtitle="Manage AI-powered actions" href="/automations" iconTone="warning" />
            {autoQ.loading ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            ) : (
              <ul className="space-y-2">
                {(autoQ.data?.items ?? []).slice(0, 3).map((a) => {
                  const t = toneStyles[a.tone as Tone];
                  return (
                    <li key={a.id} className="card-inset flex items-center gap-2.5 px-3 py-2.5">
                      <span className={cn("inline-flex size-8 shrink-0 items-center justify-center rounded-lg border", t.bg, t.border, t.text)}>
                        <Icon name={a.icon} className="size-4" />
                      </span>
                      <span className="flex-1 truncate text-[13.5px] text-text">{a.name}</span>
                      <Toggle size="sm" checked={a.enabled} onChange={(v) => void toggleAutomation(a.id, v)} label={a.name} />
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <div className="relative overflow-hidden rounded-hero border border-border min-h-[128px]">
            <SafeImage src={images.hills} alt="" sizes="360px" />
            <div className="absolute inset-0 bg-gradient-to-r from-bg/95 via-bg/70 to-bg/20" aria-hidden />
            <div className="relative p-5">
              <p className="text-[19px] font-semibold leading-snug text-text">
                Smarter homes
                <br />
                for a brighter Timor-Leste.
              </p>
              <p className="mt-1 text-[13px] text-primary">Matan AI</p>
              <Button href="/care" variant="ghost" size="xs" className="mt-2 -ml-2 text-text-2" rightIcon={<ArrowRight className="size-3.5" />}>
                Care & Family
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
