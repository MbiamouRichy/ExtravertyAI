"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

import { getSession } from "@/lib/auth-server";
import prisma from "@/lib/prisma";
import { SettingsError, requireProjectAdmin } from "@/lib/project-settings";
import {
  PROJECT_LOGO_MAX_BYTES,
  isProjectLogoKey,
  projectLogoKey,
  projectLogoUrl,
  sniffLogoType,
} from "@/lib/project-logo";

const ProjectId = z.string().cuid();

async function removeObject(key: string) {
  const { s3Client } = await import("@/lib/storage");
  await s3Client
    .send(
      new DeleteObjectCommand({ Bucket: process.env.MINIO_BUCKET, Key: key }),
    )
    .catch(() => console.error("[logo] Ancienne icône non supprimée."));
}

/** Remplace l’icône du projet. Réservé aux propriétaires et administrateurs. */
export async function updateProjectLogoAction(data: FormData) {
  const projectId = ProjectId.safeParse(data.get("projectId"));
  const file = data.get("file");
  if (!projectId.success || !(file instanceof File))
    return { success: false as const, error: "Demande invalide." };
  if (!file.size || file.size > PROJECT_LOGO_MAX_BYTES)
    return {
      success: false as const,
      error: "Choisissez une image de 2 Mo au maximum.",
    };
  const bytes = new Uint8Array(await file.arrayBuffer());
  // Le contenu fait foi : un fichier renommé en .png est refusé.
  const type = sniffLogoType(bytes);
  if (!type)
    return {
      success: false as const,
      error: "Formats acceptés : JPEG, PNG ou WEBP.",
    };
  const session = await getSession();
  if (!session?.user?.id)
    return { success: false as const, error: "Connexion requise." };
  const userId = session.user.id;
  const bucket = process.env.MINIO_BUCKET;
  if (!bucket)
    return { success: false as const, error: "Stockage indisponible." };
  let uploaded: string | null = null;
  try {
    // Droits vérifiés avant l’envoi du fichier.
    await prisma.$transaction(async (tx) => {
      const { project } = await requireProjectAdmin(tx, projectId.data, userId);
      if (project.deletionPending)
        throw new SettingsError("Ce projet est en cours de suppression.");
    });
    const key = projectLogoKey(projectId.data, crypto.randomUUID(), type);
    const { s3Client } = await import("@/lib/storage");
    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: bytes,
        ContentType: type,
      }),
      { abortSignal: AbortSignal.timeout(20_000) },
    );
    uploaded = key;
    const previous = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM project WHERE id = ${projectId.data} FOR UPDATE`;
      const { project } = await requireProjectAdmin(tx, projectId.data, userId);
      if (project.deletionPending)
        throw new SettingsError("Ce projet est en cours de suppression.");
      await tx.project.update({
        where: { id: project.id },
        data: { logoKey: key },
      });
      return project.logoKey;
    });
    uploaded = null;
    if (isProjectLogoKey(projectId.data, previous))
      await removeObject(previous);
    revalidatePath("/projects", "layout");
    return {
      success: true as const,
      logoUrl: projectLogoUrl(projectId.data, key),
    };
  } catch (error) {
    if (uploaded) await removeObject(uploaded);
    return {
      success: false as const,
      error:
        error instanceof SettingsError
          ? error.message
          : "L’icône n’a pas pu être enregistrée. Réessayez.",
    };
  }
}

/** Retire l’icône : les initiales du projet reprennent sa place. */
export async function removeProjectLogoAction(input: unknown) {
  const projectId = ProjectId.safeParse(input);
  if (!projectId.success)
    return { success: false as const, error: "Demande invalide." };
  const session = await getSession();
  if (!session?.user?.id)
    return { success: false as const, error: "Connexion requise." };
  const userId = session.user.id;
  try {
    const previous = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM project WHERE id = ${projectId.data} FOR UPDATE`;
      const { project } = await requireProjectAdmin(tx, projectId.data, userId);
      await tx.project.update({
        where: { id: project.id },
        data: { logoKey: null },
      });
      return project.logoKey;
    });
    if (isProjectLogoKey(projectId.data, previous))
      await removeObject(previous);
    revalidatePath("/projects", "layout");
    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      error:
        error instanceof SettingsError
          ? error.message
          : "L’icône n’a pas pu être retirée.",
    };
  }
}
