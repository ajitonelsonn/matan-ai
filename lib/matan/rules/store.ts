import "server-only";
import { currentUser, currentUserSub } from "@/lib/auth/server";
import { deleteItem, getItem, putItem, queryPrefix, stripKeys, userPK } from "@/lib/aws/dynamodb";
import { defaultCareContext, defaultRules } from "./defaults";
import { validateCareContext, validateRule, validateRuleId, ValidationError } from "./context";
import type { CareContext, MatanRule } from "./types";

/**
 * Per-user persistence for Care Context (SK=CARE_CONTEXT) and Smart Rules (SK=RULE#{id})
 * with in-memory caches hydrated once per process. Built-in rules exist virtually until
 * edited; edits persist the full rule. Ownership = the verified Cognito sub only.
 */
const CARE_SK = "CARE_CONTEXT";
const ruleSK = (id: string) => `RULE#${id}`;

declare global {
  // eslint-disable-next-line no-var
  var __matanCare: Map<string, CareContext> | undefined;
  // eslint-disable-next-line no-var
  var __matanRules: Map<string, Map<string, MatanRule>> | undefined;
  // eslint-disable-next-line no-var
  var __matanCareHydrated: Set<string> | undefined;
}
const careCache = () => (globalThis.__matanCare ??= new Map());
const rulesCache = (sub: string) => {
  const all = (globalThis.__matanRules ??= new Map());
  let m = all.get(sub);
  if (!m) all.set(sub, (m = new Map()));
  return m;
};
const hydrated = () => (globalThis.__matanCareHydrated ??= new Set());

export async function hydrateCare(sub: string, force = false) {
  if (!force && hydrated().has(sub)) return;
  const [ctx, rules] = await Promise.all([getItem<{ context?: CareContext }>(userPK(sub), CARE_SK), queryPrefix<Record<string, unknown>>(userPK(sub), "RULE#")]);
  careCache().set(sub, ctx?.context ? { ...defaultCareContext(), ...ctx.context } : defaultCareContext());
  const m = rulesCache(sub);
  m.clear();
  for (const it of rules) {
    const r = stripKeys<{ rule?: MatanRule }>(it).rule;
    if (r?.id) m.set(r.id, r);
  }
  hydrated().add(sub);
  console.info({ event: "dynamodb_hydrated", kind: "care", rules: rules.length, stored: Boolean(ctx?.context) });
}

/** Care context for the signed-in user (defaults when nothing stored); null outside a user scope. */
export function getCareContext(): CareContext | null {
  const u = currentUser();
  if (!u) return null;
  return careCache().get(u.sub) ?? defaultCareContext();
}

export async function saveCareContext(patch: unknown): Promise<CareContext> {
  const sub = currentUserSub();
  await hydrateCare(sub);
  const next = validateCareContext(patch, careCache().get(sub) ?? defaultCareContext());
  await putItem({ PK: userPK(sub), SK: CARE_SK, type: "CARE_CONTEXT", context: next });
  careCache().set(sub, next);
  return next;
}

/** Effective rules: stored overrides merged over the built-in defaults, then custom rules. */
export function listRules(): MatanRule[] {
  const u = currentUser();
  if (!u) return defaultRules();
  const stored = rulesCache(u.sub);
  const defaults = defaultRules();
  const merged = defaults.map((d) => stored.get(d.id) ?? d);
  const custom = [...stored.values()].filter((r) => !defaults.some((d) => d.id === r.id)).sort((a, b) => a.priority - b.priority || a.createdAt.localeCompare(b.createdAt));
  return [...merged, ...custom];
}

export async function createRule(input: unknown): Promise<MatanRule> {
  const sub = currentUserSub();
  await hydrateCare(sub);
  const rule = validateRule(input, null);
  if (rulesCache(sub).has(rule.id) || defaultRules().some((d) => d.id === rule.id)) throw new ValidationError("A rule with that id already exists.");
  await putItem({ PK: userPK(sub), SK: ruleSK(rule.id), type: "RULE", ruleId: rule.id, rule });
  rulesCache(sub).set(rule.id, rule);
  return rule;
}

export async function updateRule(id: unknown, patch: unknown): Promise<MatanRule | null> {
  const sub = currentUserSub();
  await hydrateCare(sub);
  const ruleId = validateRuleId(id);
  const base = listRules().find((r) => r.id === ruleId);
  if (!base) return null;
  const next = validateRule(patch, base);
  if (base.builtin) next.builtin = base.builtin; // built-in identity cannot be changed
  await putItem({ PK: userPK(sub), SK: ruleSK(ruleId), type: "RULE", ruleId, rule: next });
  rulesCache(sub).set(ruleId, next);
  return next;
}

/** Built-in rules cannot be deleted (only disabled); returns false when the rule doesn't exist. */
export async function deleteRule(id: unknown): Promise<boolean> {
  const sub = currentUserSub();
  await hydrateCare(sub);
  const ruleId = validateRuleId(id);
  if (defaultRules().some((d) => d.id === ruleId)) throw new ValidationError("Built-in rules cannot be deleted - disable them instead.");
  if (!rulesCache(sub).has(ruleId)) return false;
  await deleteItem(userPK(sub), ruleSK(ruleId));
  rulesCache(sub).delete(ruleId);
  return true;
}
