"use server";

import { getSession } from "@/lib/auth-server";
import prisma from "@/lib/prisma";
import { s3Client } from "@/lib/storage";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  profileImageError,
  profileImageKey,
  PROFILE_IMAGE_PATH,
} from "@/lib/profile-image";

export async function updateProfileAction(data: FormData) {
  let uploadedKey: string | null = null;
  const bucket = process.env.MINIO_BUCKET;
  try {
    const session = await getSession();
    if (!session?.user?.id)
      return { success: false as const, error: "Non authentifié." };
    const name = z
      .string()
      .trim()
      .min(2)
      .max(50)
      .optional()
      .safeParse(data.get("nom") ?? undefined);
    if (!name.success)
      return {
        success: false as const,
        error: "Le nom doit contenir entre 2 et 50 caractères.",
      };
    const file = data.get("file");
    if (file !== null) {
      if (!(file instanceof File))
        return { success: false as const, error: "Fichier image invalide." };
      const error = profileImageError(file);
      if (error) return { success: false as const, error };
    }
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: session.user.id },
    });
    let image = user.image;
    if (file instanceof File) {
      if (!bucket) throw new Error("Missing storage bucket");
      const extension = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
      }[file.type];
      const filename = `${crypto.randomUUID()}.${extension}`;
      const key = `profiles/${filename}`;
      await s3Client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: Buffer.from(await file.arrayBuffer()),
          ContentType: file.type,
        }),
      );
      uploadedKey = key;
      image = `${PROFILE_IMAGE_PATH}${filename}`;
    }
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(name.data !== undefined && { name: name.data }),
        ...(uploadedKey && { image }),
      },
      select: { name: true, image: true },
    });
    const oldKey =
      uploadedKey && bucket
        ? profileImageKey(user.image, process.env.MINIO_ENDPOINT ?? "", bucket)
        : null;
    uploadedKey = null;
    if (oldKey) {
      try {
        await s3Client.send(
          new DeleteObjectCommand({ Bucket: bucket, Key: oldKey }),
        );
      } catch (error) {
        console.error("Unable to delete previous profile image", error);
      }
    }
    revalidatePath("/projects", "layout");
    return { success: true as const, user: updated };
  } catch (error) {
    console.error("Unable to update profile", error);
    if (uploadedKey) {
      try {
        await s3Client.send(
          new DeleteObjectCommand({ Bucket: bucket, Key: uploadedKey }),
        );
      } catch (cleanupError) {
        console.error("Unable to clean up profile image", cleanupError);
      }
    }
    return {
      success: false as const,
      error: "Impossible d'enregistrer le profil. Veuillez réessayer.",
    };
  }
}
