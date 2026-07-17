import { S3Client } from "@aws-sdk/client-s3";
const accessKeyId = process.env.MINIO_ACCESS_KEY;
const secretAccessKey = process.env.MINIO_SECRET_KEY;

if (!accessKeyId || !secretAccessKey) {
  throw new Error("Les variables d'environnement MINIO sont manquantes !");
}

export const s3Client = new S3Client({
  region: "us-east-1",
  endpoint: process.env.MINIO_ENDPOINT,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
  forcePathStyle: true,
});
