import { z } from "zod";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth-server";
import { BroadcastError, broadcastImageKey } from "@/lib/broadcasts";
import { mediaKind } from "@/lib/chat-media";
import { readStoredMedia } from "@/lib/chat-media-server";

export const runtime = "nodejs";

/**
 * Image of a broadcast, for the members of its project only. Never cached,
 * never sniffed, and sandboxed even if opened directly.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; broadcastId: string }> },
) {
  const { projectId, broadcastId } = await params;
  const headers = {
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "Cross-Origin-Resource-Policy": "same-origin",
  };
  if (!z.string().cuid().safeParse(projectId).success || !z.string().cuid().safeParse(broadcastId).success) {
    return new Response(null, { status: 404, headers });
  }
  const session = await getSession();
  if (!session?.user?.id) return new Response(null, { status: 401, headers });
  try {
    const key = await broadcastImageKey(prisma, { projectId, broadcastId, userId: session.user.id });
    const media = await readStoredMedia(key, projectId);
    // Only images are ever attached to a broadcast.
    if (mediaKind(media.mime) !== "IMAGE") return new Response(null, { status: 404, headers });
    return new Response(new Uint8Array(media.bytes), {
      headers: {
        ...headers,
        "Content-Type": media.mime,
        "Content-Length": String(media.bytes.length),
        "Content-Disposition": "inline",
      },
    });
  } catch (error) {
    // Same answer whether the broadcast is missing or not visible to this user.
    if (error instanceof BroadcastError) return new Response(null, { status: 404, headers });
    return new Response(null, { status: 503, headers });
  }
}
