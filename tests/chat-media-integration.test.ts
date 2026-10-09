import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { ingestMessage } from "../lib/evolution-ingestion";
import { reconcileProviderReceipts } from "../lib/provider-reconciliation";
import { createOutboundProcessor } from "../lib/outbound-jobs";

test(
  "media ingestion, native echoes and outbound delivery remain durable",
  { timeout: 120000 },
  async () => {
    const db = await PGlite.create();
    const server = new PGLiteSocketServer({ db, host: "127.0.0.1", port: 0 });
    let prisma: PrismaClient | undefined;
    const oldFetch = globalThis.fetch;
    const oldUrl = process.env.EVOLUTION_API_URL,
      oldKey = process.env.EVOLUTION_API_KEY;
    try {
      for (const dir of (await readdir("prisma/migrations"))
        .filter((d) => /^\d/.test(d))
        .sort())
        await db.exec(
          await readFile(`prisma/migrations/${dir}/migration.sql`, "utf8"),
        );
      await server.start();
      prisma = new PrismaClient({
        adapter: new PrismaPg({
          connectionString: `postgresql://postgres:postgres@${server.getServerConn()}/postgres`,
          max: 1,
        }),
      });
      const client = prisma;
      const project = await client.project.create({
        data: {
          name: "Media test",
          numero: "24100000000",
          instanceName: "media-test",
          instanceStatus: "connected",
          status: "active",
        },
      });
      const remoteJid = "24112345678@s.whatsapp.net";
      for (const fromMe of [false, true]) {
        for (const type of ["IMAGE", "AUDIO"] as const) {
          const raw = {
            key: { id: `${type}-${fromMe}`, remoteJid, fromMe },
            message: {
              ephemeralMessage: {
                message:
                  type === "IMAGE"
                    ? { imageMessage: { caption: "Légende reçue" } }
                    : { audioMessage: { mimetype: "audio/ogg" } },
              },
            },
          };
          await client.$transaction((tx) => ingestMessage(tx, project.id, raw));
          await client.$transaction((tx) => ingestMessage(tx, project.id, raw));
        }
      }
      assert.equal(await client.message.count(), 2);
      assert.equal(await client.providerReceipt.count(), 2);
      await client.providerReceipt.updateMany({
        data: { createdAt: new Date(Date.now() - 180000) },
      });
      await reconcileProviderReceipts(client);
      assert.equal(await client.message.count(), 4);
      const echo = await client.message.findUniqueOrThrow({
        where: {
          projectId_evolutionId: {
            projectId: project.id,
            evolutionId: "AUDIO-true",
          },
        },
      });
      assert.equal(echo.type, "AUDIO");
      assert.equal(echo.content, "[AUDIO]");
      const image = await client.message.findUniqueOrThrow({
        where: {
          projectId_evolutionId: {
            projectId: project.id,
            evolutionId: "IMAGE-false",
          },
        },
      });
      assert.equal(image.content, "Légende reçue");
      const actor = await client.user.create({
        data: {
          id: crypto.randomUUID(),
          name: "Agent",
          email: "media@example.test",
          emailVerified: true,
        },
      });
      await client.projectMembership.create({
        data: { projectId: project.id, userId: actor.id, role: "ADMIN" },
      });
      const period = await client.quotaPeriod.create({
        data: {
          projectId: project.id,
          key: "media",
          kind: "active",
          startsAt: new Date(Date.now() - 60000),
          endsAt: new Date(Date.now() + 86400000),
          limit: 10,
          used: 0,
        },
      });
      process.env.EVOLUTION_API_URL = "https://provider.invalid";
      process.env.EVOLUTION_API_KEY = "fake";
      let storageFailure = false;
      const processor = createOutboundProcessor(
        client,
        async () => {},
        async (key, projectId) => {
          assert.equal(projectId, project.id);
          if (storageFailure) throw new Error("Storage unavailable");
          return {
            bytes: Buffer.from("test-media"),
            mime: key.endsWith("png")
              ? ("image/png" as const)
              : key.endsWith("mp4")
                ? ("video/mp4" as const)
                : key.endsWith("pdf")
                  ? ("application/pdf" as const)
                  : ("audio/ogg" as const),
            filename: "fichier." + key.split(".").at(-1),
          };
        },
      );
      let calls = 0;
      for (const type of [
        "IMAGE",
        "AUDIO",
        "VIDEO",
        "DOCUMENT",
        "IMAGE",
      ] as const) {
        const message = await client.message.create({
          data: {
            projectId: project.id,
            contactId: image.contactId,
            agentId: actor.id,
            senderType: "AGENT",
            fromMe: true,
            type,
            content: type === "AUDIO" ? "[AUDIO]" : "Légende",
            mediaUrl: `chat-media/${project.id}/${crypto.randomUUID()}.${type === "IMAGE" ? "png" : type === "VIDEO" ? "mp4" : type === "DOCUMENT" ? "pdf" : "ogg"}`,
          },
        });
        await client.outboundJob.create({
          data: {
            projectId: project.id,
            messageId: message.id,
            requestId: crypto.randomUUID(),
            quotaPeriodId: period.id,
          },
        });
        const claimed = await processor.claimNextJob();
        assert.ok(claimed && !claimed.cancelled);
        globalThis.fetch = async (url, init) => {
          calls++;
          const body = JSON.parse(String(init?.body));
          assert.equal(body.number, remoteJid);
          assert.equal(
            body[type === "AUDIO" ? "audio" : "media"],
            Buffer.from("test-media").toString("base64"),
          );
          assert.ok(
            String(url).includes(
              type === "AUDIO" ? "/sendWhatsAppAudio/" : "/sendMedia/",
            ),
          );
          if (type !== "AUDIO") {
            assert.equal(body.caption, "Légende");
            assert.equal(body.mediatype, type.toLowerCase());
            assert.ok(body.fileName);
          }
          if (type === "AUDIO")
            throw new Error("Transport interrupted after send");
          return Response.json({ key: { id: `outgoing-${calls}` } });
        };
        storageFailure = calls === 4;
        await processor.dispatch(claimed);
        const job = await client.outboundJob.findUniqueOrThrow({
          where: { messageId: message.id },
        });
        assert.equal(
          job.state,
          storageFailure
            ? "CANCELLED"
            : type !== "AUDIO"
              ? "ACCEPTED"
              : "UNCERTAIN",
        );
        assert.equal(await processor.claimNextJob(), null);
      }
      assert.equal(calls, 4, "missing media must never reach the provider");
    } finally {
      globalThis.fetch = oldFetch;
      if (oldUrl === undefined) delete process.env.EVOLUTION_API_URL;
      else process.env.EVOLUTION_API_URL = oldUrl;
      if (oldKey === undefined) delete process.env.EVOLUTION_API_KEY;
      else process.env.EVOLUTION_API_KEY = oldKey;
      await prisma?.$disconnect();
      await server.stop();
      await db.close();
    }
  },
);
