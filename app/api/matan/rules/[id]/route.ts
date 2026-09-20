import { NextResponse } from "next/server";
import { userRoute } from "@/lib/auth/scope";
import { deleteRule, updateRule } from "@/lib/matan/rules/store";
import { ValidationError } from "@/lib/matan/rules/context";
import { readJson } from "@/lib/api/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };
const notFound = () => NextResponse.json({ error: { code: "RULE_NOT_FOUND", title: "Rule not found", message: "That rule does not exist for your account." } }, { status: 404 });

/** PATCH /api/matan/rules/:id → edit / enable / disable (built-ins included). */
export const PATCH = userRoute(async (req, { params }: Ctx) => {
  const { id } = await params;
  try {
    const rule = await updateRule(id, await readJson(req));
    return rule ? NextResponse.json({ rule }) : notFound();
  } catch (e) {
    if (e instanceof ValidationError) return NextResponse.json({ error: { code: "RULE_INVALID", title: "Invalid rule", message: e.message } }, { status: 400 });
    throw e;
  }
});

/** DELETE /api/matan/rules/:id → remove a custom rule (built-ins are refused with 400). */
export const DELETE = userRoute(async (_req, { params }: Ctx) => {
  const { id } = await params;
  try {
    return (await deleteRule(id)) ? NextResponse.json({ deleted: id }) : notFound();
  } catch (e) {
    if (e instanceof ValidationError) return NextResponse.json({ error: { code: "RULE_BUILTIN", title: "Built-in rule", message: e.message } }, { status: 400 });
    throw e;
  }
});
