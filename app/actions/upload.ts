"use server";

import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3Client } from "@/lib/storage";
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 Mo en octets
const ALLOWED_FILE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function uploadProfilePicture(formData: FormData) {
  try {
    const file = formData.get("file") as File | null;

    if (!file) {
      return { error: "Aucun fichier fourni." };
    }

    // 1. Validation de la taille (Sécurité Serveur)
    if (file.size > MAX_FILE_SIZE) {
      return { error: "Le fichier dépasse la limite autorisée de 2 Mo." };
    }

    // 2. Validation du type de fichier
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return { error: "Seuls les formats JPEG, PNG et WEBP sont acceptés." };
    }

    // 3. Préparation du fichier
    const buffer = Buffer.from(await file.arrayBuffer());

    // Générer un nom unique pour éviter d'écraser d'autres photos
    const uniqueId = crypto.randomUUID();
    const extension = file.name.split(".").pop();
    const fileName = `profiles/${uniqueId}.${extension}`;

    // 4. Envoi vers MinIO
    const command = new PutObjectCommand({
      Bucket: process.env.MINIO_BUCKET || "extravertyai-uploads",
      Key: fileName,
      Body: buffer,
      ContentType: file.type,
    });

    await s3Client.send(command);

    // Construction de l'URL publique
    const fileUrl = `${process.env.MINIO_ENDPOINT}/${process.env.MINIO_BUCKET}/${fileName}`;

    return { success: true, url: fileUrl };
  } catch (error) {
    console.error("Erreur d'upload S3:", error);
    return { error: "Une erreur est survenue lors du téléchargement." };
  }
}
