import { NextResponse } from "next/server";
import { userRoute } from "@/lib/auth/scope";
import { createRule, listRules } from "@/lib/matan/rules/store";
import { ValidationError } from "@/lib/matan/rules/context";
import { readJson } from "@/lib/api/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/matan/rules → built-in (possibly edited) + custom rules for the signed-in user. */
export const GET = userRoute(async () => NextResponse.json({ rules: listRules() }));

/** POST /api/matan/rules → create a custom rule (validated) in the signed-in user's partition. */
export const POST = userRoute(async (req) => {
  try {
    const rule = await createRule(await readJson(req));
    return NextResponse.json({ rule }, { status: 201 });
  } catch (e) {
    if (e instanceof ValidationError) return NextResponse.json({ error: { code: "RULE_INVALID", title: "Invalid rule", message: e.message } }, { status: 400 });
    throw e;
  }
});
