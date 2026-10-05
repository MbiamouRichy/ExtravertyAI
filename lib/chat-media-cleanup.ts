import { DeleteObjectsCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";

export async function deleteProjectMedia(projectId: string) {
  const bucket = process.env.MINIO_BUCKET;
  if (!bucket) return;
  const { s3Client } = await import("./storage");
  // Restart at the prefix after each deletion; there are no new authorized uploads
  // once deletionPending is set (upload completion checks it again).
  while (true) {
    const page = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: `chat-media/${projectId}/`,
        MaxKeys: 1000,
      }),
      { abortSignal: AbortSignal.timeout(15_000) },
    );
    const objects =
      page.Contents?.flatMap((item) => (item.Key ? [{ Key: item.Key }] : [])) ??
      [];
    if (!objects.length) return;
    const result = await s3Client.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: objects, Quiet: true },
      }),
      { abortSignal: AbortSignal.timeout(15_000) },
    );
    if (result.Errors?.length) throw new Error("MEDIA_DELETE_FAILED");
  }
}
