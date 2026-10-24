import "dotenv/config";
import { ListObjectsV2Command, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { workerDatabase } from "../workers/shared";
import { s3Client } from "../lib/storage";
import {
  PROJECT_STORAGE_PREFIXES,
  isOrphanedProjectObject,
} from "../lib/chat-media-cleanup";

// Run from a scheduler daily. Tickets expire after 24 hours; keep a one-hour
// margin so a legitimate in-flight enqueue cannot race this cleanup. Also
// removes knowledge PDFs and icons that nothing references any more, such as
// the files of projects deleted before every prefix was purged.
async function main() {
  const prisma = workerDatabase();
  const bucket = process.env.MINIO_BUCKET;
  if (!bucket) throw new Error("Missing MINIO_BUCKET");
  try {
    for (const root of PROJECT_STORAGE_PREFIXES) {
      let cursor: string | undefined;
      do {
        const page = await s3Client.send(
          new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: `${root}/`,
            ContinuationToken: cursor,
          }),
        );
        for (const item of page.Contents ?? []) {
          if (
            !item.Key ||
            !item.LastModified ||
            item.LastModified.getTime() > Date.now() - 25 * 60 * 60 * 1000
          )
            continue;
          if (await isOrphanedProjectObject(prisma, item.Key))
            await s3Client.send(
              new DeleteObjectCommand({ Bucket: bucket, Key: item.Key }),
            );
        }
        cursor = page.IsTruncated ? page.NextContinuationToken : undefined;
      } while (cursor);
    }
  } finally {
    await prisma.$disconnect();
  }
}
main().catch(() => {
  console.error("Nettoyage des médias interrompu.");
  process.exitCode = 1;
});
