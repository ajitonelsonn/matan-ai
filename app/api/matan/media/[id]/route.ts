import { NextResponse } from "next/server";
import { userRoute } from "@/lib/auth/scope";
import { getMediaStream } from "@/lib/matan/media-store";
import { parseMediaRequest } from "@/lib/matan/media-key";
import { S3Error } from "@/lib/aws/s3";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/matan/media/:id(.jpg|.mp4)  →  the Ring snapshot/clip Matan AI analyzed for that event.
 * Requires the signed-in user's Cognito token; media is resolved through *their* partition
 * (PK=USER#{sub}) and the S3 key is verified to sit under their prefix before GetObject.
 * The browser never sees S3 keys or URLs.
 */
export const GET = userRoute(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const parsed = parseMediaRequest(id, new URL(req.url).searchParams.get("type"));
  if (!parsed) return NextResponse.json({ error: { code: "MEDIA_BAD_REQUEST", title: "Invalid media id", message: "That media identifier is not valid." } }, { status: 400 });
  try {
    const media = await getMediaStream(parsed.eventId, parsed.type);
    return new Response(media.body as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": media.contentType,
        ...(media.contentLength ? { "Content-Length": String(media.contentLength) } : {}),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        ...(media.capturedAt ? { "X-Media-Captured-At": media.capturedAt } : {}),
      },
    });
  } catch (e) {
    const err = e instanceof S3Error ? e : new S3Error("S3_ERROR", "Media storage request failed.", 502);
    return NextResponse.json({ error: { code: err.code, title: err.code === "MEDIA_NOT_FOUND" ? "Media not found" : "Media unavailable", message: err.message } }, { status: err.http });
  }
});
