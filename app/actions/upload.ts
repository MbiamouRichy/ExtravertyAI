"use server";

import { getSession } from "@/lib/auth-server";
import prisma from "@/lib/prisma";
import { s3Client } from "@/lib/storage";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { revalidatePath } from "next/cache";

// Constantes de sécurité
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 Mo
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function updateProfileAction(data: FormData) {
  try {
    // 1. Authentification
    const session = await getSession();
    if (!session || !session.user?.id) {
      throw new Error("Vous n'êtes pas autorisé à effectuer cette action.");
    }
    const userId = session.user.id;

    // 2. Extraction des données
    const file = data.get("file") as File | null;
    const nom = data.get("nom") as string | null;

    // Validation basique du nom
    if (nom && nom.trim().length < 2) {
      throw new Error("Le nom doit contenir au moins 2 caractères.");
    }

    // 3. Récupération de l'utilisateur
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error("Utilisateur non trouvé");

    let newImageUrl = user.image;

    // 4. Traitement du fichier AVEC sécurité serveur
    if (file && file.size > 0) {
      // Sécurité : Vérification de la taille
      if (file.size > MAX_FILE_SIZE) {
        throw new Error("Le fichier dépasse la limite autorisée de 2 Mo.");
      }

      // Sécurité : Vérification du type (Empêche l'upload de scripts ou malwares)
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        throw new Error("Seuls les formats JPEG, PNG et WEBP sont acceptés.");
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const fileName = `profiles/${crypto.randomUUID()}-${file.name.replace(/\s+/g, "-")}`;

      // A. Uploader la nouvelle image
      await s3Client.send(
        new PutObjectCommand({
          Bucket: process.env.MINIO_BUCKET,
          Key: fileName,
          Body: buffer,
          ContentType: file.type, // Utilise le type validé
        }),
      );

      newImageUrl = `${process.env.MINIO_ENDPOINT}/${process.env.MINIO_BUCKET}/${fileName}`;

      // B. Supprimer l'ancienne image
      if (user.image && user.image.includes(process.env.MINIO_BUCKET!)) {
        try {
          const oldKey = user.image.split(`${process.env.MINIO_BUCKET}/`)[1];
          await s3Client.send(
            new DeleteObjectCommand({
              Bucket: process.env.MINIO_BUCKET,
              Key: oldKey,
            }),
          );
        } catch (delError) {
          console.error(
            "Erreur lors de la suppression de l'ancienne image:",
            delError,
          );
        }
      }
    }

    // 5. Mise à jour de la base de données
    await prisma.user.update({
      where: { id: userId },
      data: {
        // Ne met à jour le nom que s'il a été fourni et nettoyé
        ...(nom && { name: nom.trim() }),
        image: newImageUrl,
      },
    });

    revalidatePath("/dashboard", "layout");
    return { success: true };
  } catch (error) {
    // Retourne le message d'erreur spécifique s'il existe, sinon un message générique
    return { error: error || "Erreur lors de la mise à jour" };
  }
}
