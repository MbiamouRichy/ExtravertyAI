import { test } from "node:test";
import assert from "node:assert/strict";
import { DeleteObjectsCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import {
  deleteProjectMedia,
  isOrphanedProjectObject,
  projectStoragePrefixes,
} from "../lib/chat-media-cleanup";
import { knowledgeFileKey } from "../lib/knowledge";
import { forgetProjectNotifications } from "../lib/notifications";
import { projectLogoKey } from "../lib/project-logo";
import { createProject, createUser, withTestDatabase } from "./helpers/database";

// In-memory bucket answering the two commands the purge uses.
function fakeBucket(keys: string[], { failDeletes = false } = {}) {
  const objects = new Set(keys);
  let deleteCalls = 0;
  const client = {
    async send(command: ListObjectsV2Command | DeleteObjectsCommand) {
      if (command instanceof ListObjectsV2Command) {
        const { Prefix = "", MaxKeys = 1000 } = command.input;
        return {
          Contents: [...objects]
            .filter((key) => key.startsWith(Prefix))
            .slice(0, MaxKeys)
            .map((Key) => ({ Key })),
        };
      }
      deleteCalls++;
      if (failDeletes) return { Errors: [{ Code: "AccessDenied" }] };
      for (const item of command.input.Delete?.Objects ?? []) objects.delete(item.Key ?? "");
      return {};
    },
  };
  return { client, objects, deleteCalls: () => deleteCalls };
}

test("every kind of project file lives under a purged prefix", () => {
  const prefixes = projectStoragePrefixes("p1");
  for (const key of [
    knowledgeFileKey("p1", "source"),
    projectLogoKey("p1", crypto.randomUUID(), "image/png"),
    `chat-media/p1/${crypto.randomUUID()}.jpg`,
  ]) {
    assert.ok(
      prefixes.some((prefix) => key.startsWith(prefix)),
      key,
    );
  }
});

test("deleting a project removes all its files and only its files", async () => {
  const mine = [
    ...Array.from({ length: 1201 }, (_, index) => `chat-media/p1/${index}.jpg`),
    "project-logos/p1/logo.png",
    "knowledge/p1/catalogue.pdf",
    "knowledge/p1/conditions.pdf",
    "exports/p1/archive.zip",
  ];
  const others = ["chat-media/p2/a.jpg", "knowledge/p2/b.pdf", "knowledge/p10/c.pdf", "profiles/user.png"];
  const bucket = fakeBucket([...mine, ...others]);
  const db = {
    storedFile: {
      // The quota registry may reference a file outside the known prefixes.
      findMany: async () => [{ key: "knowledge/p1/catalogue.pdf" }, { key: "exports/p1/archive.zip" }],
    },
  };
  await deleteProjectMedia("p1", {
    client: bucket.client,
    bucket: "test",
    db: db as unknown as NonNullable<Parameters<typeof deleteProjectMedia>[1]>["db"],
  });
  assert.deepEqual([...bucket.objects].sort(), [...others].sort());
});

test("a failed MinIO deletion stops the project deletion", async () => {
  const bucket = fakeBucket(["knowledge/p1/catalogue.pdf"], { failDeletes: true });
  await assert.rejects(
    deleteProjectMedia("p1", { client: bucket.client, bucket: "test" }),
    /MEDIA_DELETE_FAILED/,
  );
  assert.equal(bucket.deleteCalls(), 1);
});

test("without a configured bucket nothing is attempted", async () => {
  const previous = process.env.MINIO_BUCKET;
  delete process.env.MINIO_BUCKET;
  try {
    const bucket = fakeBucket(["knowledge/p1/catalogue.pdf"]);
    await deleteProjectMedia("p1", { client: bucket.client });
    assert.equal(bucket.objects.size, 1);
  } finally {
    if (previous !== undefined) process.env.MINIO_BUCKET = previous;
  }
});

test("project records outside the cascade and orphaned files", { timeout: 120000 }, async (t) => {
  await withTestDatabase(async (prisma) => {
    const project = await createProject(prisma);
    const other = await createProject(prisma);
    const user = await createUser(prisma);
    const contact = await prisma.contact.create({
      data: { projectId: project.id, remoteJid: "24101@s.whatsapp.net", phone: "24101" },
    });
    const foreign = await prisma.contact.create({
      data: { projectId: other.id, remoteJid: "24102@s.whatsapp.net", phone: "24102" },
    });

    await t.test("notification receipts of the project are forgotten", async () => {
      for (const key of [
        `message:${contact.id}`,
        `quiet:${contact.id}`,
        `billing:${project.id}`,
        `message:${foreign.id}`,
        `billing:${other.id}`,
      ]) {
        await prisma.$executeRaw`INSERT INTO notification_receipt ("userId", key, version) VALUES (${user.id}, ${key}, 'v1')`;
      }
      assert.equal(await forgetProjectNotifications(prisma, project.id), 3);
      const left = await prisma.$queryRaw<Array<{ key: string }>>`SELECT key FROM notification_receipt ORDER BY key`;
      assert.deepEqual(
        left.map((row) => row.key),
        [`billing:${other.id}`, `message:${foreign.id}`].sort(),
      );
    });

    await t.test("orphaned files are recognised by what references them", async () => {
      await prisma.message.create({
        data: {
          projectId: project.id,
          contactId: contact.id,
          content: "[IMAGE]",
          senderType: "AGENT",
          fromMe: true,
          type: "IMAGE",
          mediaUrl: `chat-media/${project.id}/kept.jpg`,
        },
      });
      await prisma.knowledgeSource.create({
        data: {
          projectId: project.id,
          type: "PDF",
          name: "catalogue.pdf",
          storageKey: knowledgeFileKey(project.id, "kept"),
        },
      });
      const logo = projectLogoKey(project.id, crypto.randomUUID(), "image/png");
      await prisma.project.update({ where: { id: project.id }, data: { logoKey: logo } });

      for (const [key, orphaned] of [
        [`chat-media/${project.id}/kept.jpg`, false],
        [`chat-media/${project.id}/abandoned.jpg`, true],
        [knowledgeFileKey(project.id, "kept"), false],
        [knowledgeFileKey("deleted-project", "left-behind"), true],
        [logo, false],
        [projectLogoKey(project.id, crypto.randomUUID(), "image/png"), true],
        ["profiles/someone.png", false],
        ["knowledge/../secret", false],
      ] as const) {
        assert.equal(await isOrphanedProjectObject(prisma, key), orphaned, key);
      }
    });
  });
});
