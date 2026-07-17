"use server";

import prisma from "@/lib/prisma";
import { s3Client } from "@/lib/storage";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { revalidatePath } from "next/cache";

export async function updateProfileAction(data: FormData) {
  try {
    // 1. Récupérer les données
    const nom = data.get("nom") as string | null;
    const file = data.get("file") as File | null;
    const ID = data.get("userId") as string | null;

    if (!ID) {
      throw new Error("ID utilisateur manquant.");
    }

    let newImageUrl = null;

    // 2. Traiter le fichier (s'il y en a un nouveau)
    if (file && file.size > 0) {
      // Revérification de sécurité côté serveur (obligatoire)
      if (file.size > 2 * 1024 * 1024) throw new Error("Fichier trop lourd.");

      const buffer = Buffer.from(await file.arrayBuffer());
      const fileName = `profiles/${crypto.randomUUID()}-${file.name}`;

      await s3Client.send(
        new PutObjectCommand({
          Bucket: process.env.MINIO_BUCKET,
          Key: fileName,
          Body: buffer,
          ContentType: file.type,
        }),
      );

      newImageUrl = `${process.env.MINIO_ENDPOINT}/${process.env.MINIO_BUCKET}/${fileName}`;
    }

    await prisma.user.update({
      where: { id: ID },
      data: {
        ...(nom && { name: nom }),
        ...(newImageUrl && { image: newImageUrl }),
      },
    });
    revalidatePath("/dashboard", "layout");
    return { success: true };
  } catch (error) {
    console.error(error);
    return { error: "Échec de la mise à jour" };
  }
}
