import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth-server";
import {
  mediaResponse,
  readProviderMedia,
  readStoredMedia,
} from "@/lib/chat-media-server";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string; messageId: string }> },
) {
  const { projectId, messageId } = await params;
  const headers = {
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };
  const session = await getSession();
  if (!session?.user?.id) return new Response(null, { status: 401, headers });
  const member = await prisma.projectMembership.findUnique({
    where: { userId_projectId: { userId: session.user.id, projectId } },
    select: { userId: true },
  });
  if (!member) return new Response(null, { status: 404, headers });
  const message = await prisma.message.findFirst({
    where: {
      id: messageId,
      projectId,
      type: { in: ["IMAGE", "AUDIO", "VIDEO", "DOCUMENT"] },
      project: { deletionPending: false },
    },
    include: {
      contact: { select: { remoteJid: true } },
      project: { select: { instanceName: true } },
    },
  });
  if (!message) return new Response(null, { status: 404, headers });
  try {
    const media = message.mediaUrl?.startsWith(`chat-media/${projectId}/`)
      ? await readStoredMedia(message.mediaUrl, projectId)
      : message.evolutionId && message.project.instanceName
        ? await readProviderMedia({
            evolutionId: message.evolutionId,
            fromMe: message.fromMe,
            type: message.type,
            remoteJid: message.contact.remoteJid,
            instanceName: message.project.instanceName,
          })
        : null;
    if (!media) return new Response(null, { status: 404, headers });
    return mediaResponse(
      media.bytes,
      media.mime,
      request.headers.get("range"),
      media.filename,
    );
  } catch {
    return Response.json(
      {
        error:
          "Média indisponible ou trop volumineux (4 Mo maximum). Réessayez.",
      },
      { status: 503, headers },
    );
  }
}
