import { getMedia } from "@/lib/matan/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/matan/media/:id -> the Ring snapshot Matan AI analyzed for that event (server memory, same-origin). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const isVideo = /\.mp4$/i.test(id) || new URL(req.url).searchParams.get("type") === "video";
  const media = getMedia(id.replace(/\.(jpe?g|png|mp4)$/i, ""), isVideo ? "video" : "image");
  if (!media) return new Response("Not found", { status: 404 });
  return new Response(media.bytes as unknown as BodyInit, {
    status: 200,
    headers: { "Content-Type": media.contentType, "Cache-Control": "private, no-store", "Accept-Ranges": "bytes", ...(media.capturedAt ? { "X-Media-Captured-At": media.capturedAt } : {}) },
  });
}
