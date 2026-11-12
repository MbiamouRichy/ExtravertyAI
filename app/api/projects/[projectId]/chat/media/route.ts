import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth-server";
import { acceptChatMediaUpload, s3MediaStorage } from "@/lib/chat-media-upload";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const json = (error: string, status: number) =>
    Response.json({ error }, { status });
  const session = await getSession();
  if (!session?.user?.id) return json("Connexion requise.", 401);
  // Raw uploads use a custom content type; also reject cross-origin browser requests.
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return json("Accès refusé.", 403);
  // Rôle, projet, type réel, taille, quota et nom : voir acceptChatMediaUpload.
  const result = await acceptChatMediaUpload(prisma, s3MediaStorage, {
    userId: session.user.id,
    projectId,
    requestId: new URL(request.url).searchParams.get("requestId"),
    contentType: request.headers.get("content-type"),
    contentLength: request.headers.get("content-length"),
    filename: request.headers.get("x-file-name"),
    body: request.body,
  });
  return Response.json(result.body, {
    status: result.status,
    headers: { "Cache-Control": "no-store" },
  });
}
