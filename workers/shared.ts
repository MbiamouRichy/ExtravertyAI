import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import Pusher from "pusher";
import { DATABASE_SESSION_OPTIONS } from "../lib/database-session";

export function workerDatabase() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL manquant.");
  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString: process.env.DATABASE_URL,
      options: DATABASE_SESSION_OPTIONS,
      max: 3,
    }),
  });
}

export async function notifyProject(projectId: string) {
  const {
    PUSHER_APP_ID: appId,
    PUSHER_KEY: key,
    PUSHER_SECRET: secret,
    PUSHER_CLUSTER: cluster,
  } = process.env;
  if (!appId || !key || !secret || !cluster) return;
  try {
    await new Pusher({
      appId,
      key,
      secret,
      cluster,
      useTLS: true,
      timeout: 5000,
    }).trigger(`private-project-${projectId}`, "chat.changed", { version: 1 });
  } catch {
    console.error("[worker] Notification indisponible.");
  }
}
