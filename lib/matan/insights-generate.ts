import "server-only";
import type { InsightRange } from "@/lib/types";
import { getRingEvents } from "@/lib/ring/overview";
import { eventsInRange, rangeLabel, type InsightWindow } from "@/lib/mock/insights";
import { generateTextWithNova } from "@/lib/bedrock/nova";
import { buildPeriodContext, buildSummaryPrompt, SUMMARY_SYSTEM_PROMPT } from "./insights-summary";
import { getCareContext } from "./rules/store";
import { currentUserSub } from "@/lib/auth/server";
import { TIME_ZONE } from "@/lib/mock/clock";

export interface PeriodSummary {
  summary: string;
  model: string | null;
  generatedAt: string;
  eventCount: number;
  analyzedCount: number;
  rangeLabel: string;
  cached: boolean;
}

const CACHE_MS = 10 * 60_000;
const cache = new Map<string, PeriodSummary>();

/**
 * Write a summary of the signed-in user's real Ring events for a period with Nova.
 * Cached per user/period for 10 minutes so repeated clicks do not burn tokens; when the
 * period has no analyzed events the text says so without calling the model.
 */
export async function generatePeriodSummary(range: InsightRange, window: InsightWindow | null): Promise<PeriodSummary> {
  const label = rangeLabel(range, window);
  const key = `${currentUserSub()}|${range}|${window?.from ?? ""}|${window?.to ?? ""}`;
  const { events } = await getRingEvents();
  const current = eventsInRange(events, range, 0, window);
  const analyzed = current.filter((e) => e.analysis === "done");
  const fingerprint = `${current.length}:${analyzed.length}:${current[0]?.id ?? ""}`;
  const hit = cache.get(key);
  if (hit && Date.now() - new Date(hit.generatedAt).getTime() < CACHE_MS && (hit as PeriodSummary & { fp?: string }).fp === fingerprint) return { ...hit, cached: true };

  if (!analyzed.length) {
    return { summary: current.length ? `${current.length} Ring events were recorded in this period but none has a completed Matan AI analysis yet, so there is nothing to summarize. Open an event and run Analyze.` : "No Ring events were recorded in this period, so there is nothing to summarize.", model: null, generatedAt: new Date().toISOString(), eventCount: current.length, analyzedCount: 0, rangeLabel: label, cached: false };
  }

  const ctx = buildPeriodContext(current, range, label, getCareContext()?.timezone ?? TIME_ZONE);
  const started = Date.now();
  const res = await generateTextWithNova(SUMMARY_SYSTEM_PROMPT, buildSummaryPrompt(ctx), { maxTokens: 400 });
  console.info({ event: "matan_insights_summary", range, events: current.length, analyzed: analyzed.length, model: res.model, latencyMs: Date.now() - started, usage: res.usage });
  const out: PeriodSummary & { fp?: string } = { summary: res.text, model: res.model, generatedAt: new Date().toISOString(), eventCount: current.length, analyzedCount: analyzed.length, rangeLabel: label, cached: false, fp: fingerprint };
  cache.set(key, out);
  const { fp: _fp, ...pub } = out;
  void _fp;
  return pub;
}
