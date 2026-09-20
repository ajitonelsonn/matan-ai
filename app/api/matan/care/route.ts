import { NextResponse } from "next/server";
import { userRoute } from "@/lib/auth/scope";
import { getCareContext, saveCareContext } from "@/lib/matan/rules/store";
import { ValidationError } from "@/lib/matan/rules/context";
import { readJson } from "@/lib/api/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/matan/care → the signed-in user's care context (defaults when nothing is stored). */
export const GET = userRoute(async () => NextResponse.json({ context: getCareContext() }));

/** PUT /api/matan/care → validate + persist a (partial) care context for the signed-in user only. */
export const PUT = userRoute(async (req) => {
  try {
    const context = await saveCareContext(await readJson(req));
    return NextResponse.json({ context });
  } catch (e) {
    if (e instanceof ValidationError) return NextResponse.json({ error: { code: "CARE_INVALID", title: "Invalid care context", message: e.message } }, { status: 400 });
    throw e;
  }
});
