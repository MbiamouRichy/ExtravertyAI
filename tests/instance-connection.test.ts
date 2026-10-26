import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { confirmInstanceConnection } from "../lib/instance-connection";

test(
  "provider connection confirmation preserves newer project state",
  { timeout: 120000 },
  async (t) => {
    const db = await PGlite.create();
    const server = new PGLiteSocketServer({ db, host: "127.0.0.1", port: 0 });
    let client: PrismaClient | undefined;
    try {
      for (const folder of (await readdir("prisma/migrations"))
        .filter((name) => /^\d/.test(name))
        .sort()) {
        await db.exec(
          await readFile(`prisma/migrations/${folder}/migration.sql`, "utf8"),
        );
      }
      await server.start();
      const prisma = (client = new PrismaClient({
        adapter: new PrismaPg({
          connectionString: `postgresql://postgres:postgres@${server.getServerConn()}/postgres`,
          max: 1,
        }),
      }));
      const fixture = () =>
        prisma.project.create({
          data: {
            name: "Connection test",
            numero: "24100000000",
            instanceName: crypto.randomUUID(),
            status: "active",
            instanceStatus: "disconnected",
            updatedAt: new Date("2025-01-01"),
          },
        });

      await t.test(
        "persists success without waiting for a webhook so the chat can open",
        async () => {
          const project = await fixture();
          assert.equal(
            await confirmInstanceConnection(prisma, project),
            "connected",
          );
          const saved = await prisma.project.findUniqueOrThrow({
            where: { id: project.id },
          });
          assert.equal(saved.instanceStatus, "connected");
        },
      );

      await t.test(
        "does not overwrite a newer disconnection even when the status is unchanged",
        async () => {
          const project = await fixture();
          await prisma.project.update({
            where: { id: project.id },
            data: { instanceStatus: "disconnected" },
          });
          assert.equal(
            await confirmInstanceConnection(prisma, project),
            "disconnected",
          );
        },
      );

      await t.test("accepts a concurrent successful webhook", async () => {
        const project = await fixture();
        await prisma.project.update({
          where: { id: project.id },
          data: { instanceStatus: "connected" },
        });
        assert.equal(
          await confirmInstanceConnection(prisma, project),
          "connected",
        );
      });

      await t.test(
        "does not connect a project deactivated during the provider request",
        async () => {
          const project = await fixture();
          await prisma.project.update({
            where: { id: project.id },
            data: { status: "inactive" },
          });
          assert.equal(
            await confirmInstanceConnection(prisma, project),
            "disconnected",
          );
        },
      );
    } finally {
      await client?.$disconnect();
      await server.stop();
      await db.close();
    }
  },
);
