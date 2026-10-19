import { NextResponse } from "next/server";
import { z } from "zod";

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth-server";
import { notifyChatChanged } from "@/lib/chat-realtime";
import { readLimitedBody } from "@/lib/chat-media-server";
import { SettingsError } from "@/lib/project-settings";
import { KnowledgeError, addPdfSource } from "@/lib/knowledge";
import { removeKnowledgeFile, storeKnowledgeFile } from "@/lib/knowledge-extract";
import { KNOWLEDGE_LIMITS } from "@/lib/knowledge-shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json<T>(value: T, status = 200) {
  return NextResponse.json(value, { status, headers: { "Cache-Control": "private, no-store" } });
}

/**
 * Raw PDF body (not multipart) so the size limit applies while streaming.
 * The file name travels in a header, URI-encoded.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const session = await getSession();
  if (!session?.user?.id) return json({ error: "Connexion requise." }, 401);
  if (!z.string().cuid().safeParse(projectId).success) {
    return json({ error: "Projet indisponible." }, 404);
  }
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/pdf") {
    return json({ error: "Choisissez un fichier PDF." }, 415);
  }
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > KNOWLEDGE_LIMITS.pdfMaxBytes) {
    return json({ error: "Le PDF dépasse 10 Mo." }, 413);
  }
  let fileName = "Document.pdf";
  try {
    fileName = decodeURIComponent(request.headers.get("x-file-name") ?? fileName).slice(0, 200);
  } catch {
    // Keep the default name.
  }
  let bytes: Buffer;
  try {
    bytes = await readLimitedBody(request.body, KNOWLEDGE_LIMITS.pdfMaxBytes);
  } catch (error) {
    return error instanceof Error && error.message === "MEDIA_TOO_LARGE"
      ? json({ error: "Le PDF dépasse 10 Mo." }, 413)
      : json({ error: "Le fichier est vide." }, 400);
  }
  try {
    const source = await addPdfSource(
      prisma,
      { projectId, userId: session.user.id, fileName, bytes },
      { put: storeKnowledgeFile, remove: removeKnowledgeFile },
    );
    await notifyChatChanged(projectId);
    return json({ id: source.id }, 201);
  } catch (error) {
    if (error instanceof KnowledgeError || error instanceof SettingsError) {
      return json({ error: error.message }, 400);
    }
    console.error("[knowledge] Échec du téléversement PDF.");
    return json({ error: "Impossible d’importer ce PDF. Réessayez." }, 500);
  }
}
