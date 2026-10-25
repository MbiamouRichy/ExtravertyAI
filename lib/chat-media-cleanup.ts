import { DeleteObjectsCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import type { PrismaClient } from "../src/generated/prisma/client";

/**
 * Every MinIO prefix holding a project's files. A new kind of project file
 * must be stored under one of these prefixes (or recorded in StoredFile) so
 * that deleting the project also deletes it.
 */
export const PROJECT_STORAGE_PREFIXES = [
  // Pièces jointes envoyées depuis la messagerie.
  "chat-media",
  // Icône du projet.
  "project-logos",
  // PDF de la base de connaissances.
  "knowledge",
] as const;

export function projectStoragePrefixes(projectId: string) {
  return PROJECT_STORAGE_PREFIXES.map((root) => `${root}/${projectId}/`);
}

type StorageClient = {
  send(
    command: ListObjectsV2Command | DeleteObjectsCommand,
    options?: { abortSignal?: AbortSignal },
  ): Promise<{
    Contents?: Array<{ Key?: string }>;
    Errors?: unknown[];
  }>;
};

async function deleteKeys(client: StorageClient, bucket: string, keys: string[]) {
  for (let start = 0; start < keys.length; start += 1000) {
    const result = await client.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: keys.slice(start, start + 1000).map((Key) => ({ Key })), Quiet: true },
      }),
      { abortSignal: AbortSignal.timeout(15_000) },
    );
    if (result.Errors?.length) throw new Error("MEDIA_DELETE_FAILED");
  }
}

/**
 * Deletes every file of a project from MinIO: attachments, icon, knowledge
 * PDFs, plus any file recorded in StoredFile under another prefix. Called
 * before the project row is deleted; a failure keeps the project (paused) so
 * that the deletion can be retried without leaving orphaned files.
 */
export async function deleteProjectMedia(
  projectId: string,
  options: {
    db?: Pick<PrismaClient, "storedFile">;
    client?: StorageClient;
    bucket?: string;
  } = {},
) {
  const bucket = options.bucket ?? process.env.MINIO_BUCKET;
  if (!bucket) return;
  const client: StorageClient =
    options.client ?? (await import("./storage")).s3Client;
  const prefixes = projectStoragePrefixes(projectId);
  // Restart at the prefix after each deletion; there are no new authorized uploads
  // once deletionPending is set (upload completion checks it again).
  for (const prefix of prefixes)
    while (true) {
      const page = await client.send(
        new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, MaxKeys: 1000 }),
        { abortSignal: AbortSignal.timeout(15_000) },
      );
      const keys = page.Contents?.flatMap((item) => (item.Key ? [item.Key] : [])) ?? [];
      if (!keys.length) break;
      await deleteKeys(client, bucket, keys);
    }
  // Safety net: files counted in the storage quota but stored elsewhere.
  if (options.db) {
    const stray = (
      await options.db.storedFile.findMany({ where: { projectId }, select: { key: true } })
    )
      .map((file) => file.key)
      .filter((key) => !prefixes.some((prefix) => key.startsWith(prefix)));
    if (stray.length) await deleteKeys(client, bucket, stray);
  }
}

/**
 * True when a stored object no longer belongs to anything: an abandoned
 * upload, a replaced icon, or a file left by a project deleted before every
 * prefix was covered. Unknown prefixes are never reported.
 */
export async function isOrphanedProjectObject(
  db: Pick<PrismaClient, "message" | "knowledgeSource" | "project" | "broadcast">,
  key: string,
) {
  const [root, projectId] = key.split("/");
  if (!projectId || key.includes("..")) return false;
  switch (root) {
    case "chat-media":
      // A scheduled broadcast holds its image before any message uses it.
      return (
        !(await db.message.findFirst({ where: { mediaUrl: key }, select: { id: true } })) &&
        !(await db.broadcast.findFirst({ where: { mediaUrl: key }, select: { id: true } }))
      );
    case "knowledge":
      return !(await db.knowledgeSource.findFirst({ where: { storageKey: key }, select: { id: true } }));
    case "project-logos":
      return !(await db.project.findFirst({ where: { logoKey: key }, select: { id: true } }));
    default:
      return false;
  }
}
