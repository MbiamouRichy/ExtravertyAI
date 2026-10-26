import { GetObjectCommand } from "@aws-sdk/client-s3";
import { z } from "zod";

import { getSession } from "@/lib/auth-server";
import prisma from "@/lib/prisma";
import { s3Client } from "@/lib/storage";
import {
  PROJECT_LOGO_MAX_BYTES,
  PROJECT_LOGO_TYPES,
  isProjectLogoKey,
} from "@/lib/project-logo";

export const runtime = "nodejs";

/** Icône du projet, visible par ses seuls membres. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const session = await getSession();
  if (!session?.user?.id) return new Response(null, { status: 401 });
  const { projectId } = await context.params;
  if (!z.string().cuid().safeParse(projectId).success)
    return new Response(null, { status: 404 });
  const membership = await prisma.projectMembership.findUnique({
    where: { userId_projectId: { userId: session.user.id, projectId } },
    select: { project: { select: { logoKey: true } } },
  });
  const key = membership?.project.logoKey ?? null;
  if (!isProjectLogoKey(projectId, key))
    return new Response(null, { status: 404 });
  try {
    const object = await s3Client.send(
      new GetObjectCommand({ Bucket: process.env.MINIO_BUCKET, Key: key }),
    );
    if (
      !object.Body ||
      !Object.hasOwn(PROJECT_LOGO_TYPES, object.ContentType ?? "") ||
      !object.ContentLength ||
      object.ContentLength > PROJECT_LOGO_MAX_BYTES
    )
      return new Response(null, { status: 404 });
    return new Response(
      new Uint8Array(await object.Body.transformToByteArray()),
      {
        headers: {
          "Content-Type": object.ContentType!,
          // L’adresse change avec chaque nouvelle icône (?v=…).
          "Cache-Control": "private, max-age=86400",
          "X-Content-Type-Options": "nosniff",
          "Content-Security-Policy": "default-src 'none'",
        },
      },
    );
  } catch {
    console.error("[logo] Icône indisponible.");
    return new Response(null, { status: 502 });
  }
}
