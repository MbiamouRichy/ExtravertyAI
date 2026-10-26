import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
import { ingestMessage } from "../../lib/evolution-ingestion";

/** Isolated PostgreSQL WASM database with every migration applied. Never reads DATABASE_URL. */
export async function withTestDatabase(
  run: (prisma: PrismaClient) => Promise<void>,
) {
  const db = await PGlite.create();
  const server = new PGLiteSocketServer({ db, host: "127.0.0.1", port: 0 });
  let prisma: PrismaClient | undefined;
  try {
    for (const folder of (await readdir("prisma/migrations"))
      .filter((name) => /^\d/.test(name))
      .sort()) {
      await db.exec(
        await readFile(`prisma/migrations/${folder}/migration.sql`, "utf8"),
      );
    }
    await server.start();
    prisma = new PrismaClient({
      adapter: new PrismaPg({
        connectionString: `postgresql://postgres:postgres@${server.getServerConn()}/postgres`,
        max: 1,
      }),
    });
    await run(prisma);
  } finally {
    await prisma?.$disconnect();
    await server.stop();
    await db.close();
  }
}

export async function createUser(prisma: PrismaClient, name = "Agent") {
  return prisma.user.create({
    data: {
      id: crypto.randomUUID(),
      name,
      email: crypto.randomUUID() + "@example.test",
    },
  });
}

export async function createProject(
  prisma: PrismaClient,
  data: { plan?: "starter" | "pro" | "business" } = {},
) {
  return prisma.project.create({
    data: {
      name: "Test",
      numero: "24100000000",
      instanceName: crypto.randomUUID(),
      status: "active",
      plan: data.plan ?? "starter",
    },
  });
}

export async function addMember(
  prisma: PrismaClient,
  projectId: string,
  userId: string,
  role: "OWNER" | "ADMIN" | "SUPERVISOR" | "AGENT" | "VIEWER" | "BILLING" = "AGENT",
) {
  return prisma.projectMembership.create({ data: { projectId, userId, role } });
}

/** Simulates an incoming WhatsApp text through the real ingestion path. */
export async function ingestText(
  prisma: PrismaClient,
  projectId: string,
  text: string,
  remoteJid = "24112345678@s.whatsapp.net",
) {
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM project WHERE id = ${projectId} FOR UPDATE`;
    await ingestMessage(tx, projectId, {
      key: { id: crypto.randomUUID(), fromMe: false, remoteJid },
      message: { conversation: text },
    });
  });
  return prisma.contact.findFirstOrThrow({ where: { projectId, remoteJid } });
}
