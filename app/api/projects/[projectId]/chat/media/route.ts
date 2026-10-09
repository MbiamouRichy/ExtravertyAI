import { z } from "zod";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth-server";
import {
  MAX_MEDIA_BYTES,
  MEDIA_TYPES,
  mediaKind,
  safeMediaFilename,
} from "@/lib/chat-media";
import {
  readLimitedBody,
  signMediaTicket,
  validateMediaBytes,
} from "@/lib/chat-media-server";
import { projectBillingStatus } from "@/lib/project-status";
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
  const requestId = z
    .string()
    .uuid()
    .safeParse(new URL(request.url).searchParams.get("requestId"));
  if (!z.string().cuid().safeParse(projectId).success || !requestId.success)
    return json("Demande invalide.", 400);
  const member = await prisma.projectMembership.findUnique({
    where: { userId_projectId: { userId: session.user.id, projectId } },
    include: { project: true },
  });
  if (!member || member.project.deletionPending)
    return json("Projet indisponible.", 404);
  if (
    !["active", "trialing"].includes(projectBillingStatus(member.project)) ||
    member.project.instanceStatus !== "connected"
  )
    return json("Un projet actif et connecté à WhatsApp est requis.", 409);
  const mime = request.headers.get("content-type")?.split(";")[0].trim() || "";
  if (!Object.hasOwn(MEDIA_TYPES, mime))
    return json("Format non pris en charge.", 415);
  if (Number(request.headers.get("content-length")) > MAX_MEDIA_BYTES)
    return json("Le fichier dépasse 4 Mo.", 413);
  try {
    const bytes = await readLimitedBody(request.body, MAX_MEDIA_BYTES);
    validateMediaBytes(bytes, mime);
    const filename = safeMediaFilename(
      decodeURIComponent(request.headers.get("x-file-name") || ""),
      mime,
    );
    const key = `chat-media/${projectId}/${crypto.randomUUID()}.${MEDIA_TYPES[mime]}`;
    const token = signMediaTicket({
      key,
      mime,
      projectId,
      userId: session.user.id,
      requestId: requestId.data,
      expires: Date.now() + 24 * 60 * 60 * 1000,
    });
    const { s3Client } = await import("@/lib/storage");
    const { PutObjectCommand, DeleteObjectCommand } =
      await import("@aws-sdk/client-s3");
    await s3Client.send(
      new PutObjectCommand({
        Bucket: process.env.MINIO_BUCKET,
        Key: key,
        Body: bytes,
        ContentType: mime,
        Metadata: { filename: encodeURIComponent(filename) },
      }),
      { abortSignal: AbortSignal.timeout(20_000) },
    );
    const stillAllowed = await prisma.projectMembership.findFirst({
      where: {
        userId: session.user.id,
        projectId,
        project: { deletionPending: false },
      },
      select: { id: true },
    });
    if (!stillAllowed) {
      await s3Client.send(
        new DeleteObjectCommand({ Bucket: process.env.MINIO_BUCKET, Key: key }),
      );
      return json("Projet indisponible.", 404);
    }
    return Response.json(
      {
        token,
        type: mediaKind(mime),
        requestId: requestId.data,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (
      error instanceof Error &&
      ["MEDIA_INVALID", "MEDIA_TOO_LARGE", "EMPTY_BODY"].includes(error.message)
    )
      return json("Fichier invalide ou supérieur à 4 Mo.", 400);
    return json("Le fichier n’a pas pu être importé. Réessayez.", 503);
  }
}
