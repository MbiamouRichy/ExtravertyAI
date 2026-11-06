import { GetObjectCommand } from "@aws-sdk/client-s3";
import { z } from "zod";

import { getSession } from "@/lib/auth-server";
import prisma from "@/lib/prisma";
import { s3Client } from "@/lib/storage";
import { can } from "@/lib/project-permissions";
import {
  CONTACT_AVATAR_MAX_BYTES,
  isContactAvatarKey,
} from "@/lib/contact-avatar";
import { PROJECT_LOGO_TYPES } from "@/lib/project-logo";

export const runtime = "nodejs";

/**
 * Photo de profil d’un prospect, visible par les seuls membres qui voient ses
 * conversations ou la liste des contacts. Toute absence répond 404, sans dire
 * si le contact existe.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string; contactId: string }> },
) {
  const session = await getSession();
  if (!session?.user?.id) return new Response(null, { status: 401 });
  const { projectId, contactId } = await context.params;
  if (
    !z.string().cuid().safeParse(projectId).success ||
    !z.string().cuid().safeParse(contactId).success
  )
    return new Response(null, { status: 404 });
  const [membership, contact] = await Promise.all([
    prisma.projectMembership.findUnique({
      where: { userId_projectId: { userId: session.user.id, projectId } },
      select: { role: true },
    }),
    prisma.contact.findFirst({
      where: { id: contactId, projectId },
      select: { avatarKey: true },
    }),
  ]);
  if (
    !membership ||
    !(can(membership.role, "conversations.handle") || can(membership.role, "contacts.view"))
  )
    return new Response(null, { status: 404 });
  const key = contact?.avatarKey ?? null;
  if (!isContactAvatarKey(projectId, contactId, key))
    return new Response(null, { status: 404 });
  try {
    const object = await s3Client.send(
      new GetObjectCommand({ Bucket: process.env.MINIO_BUCKET, Key: key }),
    );
    if (
      !object.Body ||
      !Object.hasOwn(PROJECT_LOGO_TYPES, object.ContentType ?? "") ||
      !object.ContentLength ||
      object.ContentLength > CONTACT_AVATAR_MAX_BYTES
    )
      return new Response(null, { status: 404 });
    return new Response(
      new Uint8Array(await object.Body.transformToByteArray()),
      {
        headers: {
          "Content-Type": object.ContentType!,
          // L’adresse change avec chaque nouvelle photo (?v=…).
          "Cache-Control": "private, max-age=86400",
          "X-Content-Type-Options": "nosniff",
          "Content-Security-Policy": "default-src 'none'",
        },
      },
    );
  } catch {
    console.error("[avatar] Photo de profil indisponible.");
    return new Response(null, { status: 502 });
  }
}
