/**
 * Token budget guard for Bedrock spend (in-memory, per server process).
 * MATAN_AI_MONTHLY_TOKEN_BUDGET (default 5,000,000 tokens ≈ $4 of Nova Pro input).
 * - At >= 80% of budget, video escalation is disabled (snapshot/context only).
 * - At >= 100%, analyses are refused with MATAN_AI_BUDGET_EXCEEDED.
 */
export const MONTHLY_TOKEN_BUDGET = Number(process.env.MATAN_AI_MONTHLY_TOKEN_BUDGET ?? 5_000_000);
export const VIDEO_ESCALATION_CEILING = 0.8;

/** Approximate Nova Pro on-demand pricing (USD per 1M tokens) used only for display. */
export const NOVA_PRO_USD_PER_M_INPUT = 0.8;
export const NOVA_PRO_USD_PER_M_OUTPUT = 3.2;

interface BudgetState {
  month: string;
  inputTokens: number;
  outputTokens: number;
  calls: number;
  videoCalls: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __matanBudget: BudgetState | undefined;
}

function monthKey(d = new Date()) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function state(): BudgetState {
  const m = monthKey();
  if (!globalThis.__matanBudget || globalThis.__matanBudget.month !== m) globalThis.__matanBudget = { month: m, inputTokens: 0, outputTokens: 0, calls: 0, videoCalls: 0 };
  return globalThis.__matanBudget;
}

export function recordUsage(inputTokens = 0, outputTokens = 0, video = false) {
  const s = state();
  s.inputTokens += inputTokens;
  s.outputTokens += outputTokens;
  s.calls += 1;
  if (video) s.videoCalls += 1;
}

export function budgetSnapshot() {
  const s = state();
  const used = s.inputTokens + s.outputTokens;
  return {
    month: s.month,
    budgetTokens: MONTHLY_TOKEN_BUDGET,
    usedTokens: used,
    usedPct: MONTHLY_TOKEN_BUDGET ? Math.round((used / MONTHLY_TOKEN_BUDGET) * 1000) / 10 : 0,
    calls: s.calls,
    videoCalls: s.videoCalls,
    estimatedUsd: Math.round(((s.inputTokens * NOVA_PRO_USD_PER_M_INPUT + s.outputTokens * NOVA_PRO_USD_PER_M_OUTPUT) / 1_000_000) * 10000) / 10000,
    videoAllowed: MONTHLY_TOKEN_BUDGET === 0 || used < MONTHLY_TOKEN_BUDGET * VIDEO_ESCALATION_CEILING,
    exhausted: MONTHLY_TOKEN_BUDGET > 0 && used >= MONTHLY_TOKEN_BUDGET,
  };
}
