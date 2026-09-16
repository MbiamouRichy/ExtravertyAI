import type { PrismaClient } from "../src/generated/prisma/client";

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("SETTINGS_RESPONSE_INVALID");
  return value as Record<string, unknown>;
}
export async function syncWhatsAppSettings(prisma: PrismaClient) {
  const candidate = await prisma.project.findFirst({
    where: {
      whatsappSettingsPending: true,
      deletionPending: false,
      whatsappSyncAfter: { lte: new Date() },
    },
    orderBy: { whatsappSyncAfter: "asc" },
    select: { id: true },
  });
  if (!candidate) return;
  try {
    // Rare configuration changes use the project lock across the idempotent setter.
    // This serializes competing workers and prevents an older setting overwriting a newer one.
    await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM project WHERE id = ${candidate.id} FOR UPDATE`;
        const project = await tx.project.findUnique({
          where: { id: candidate.id },
        });
        if (
          !project?.whatsappSettingsPending ||
          project.deletionPending ||
          project.whatsappSyncAfter > new Date()
        )
          return;
        const base = process.env.EVOLUTION_API_URL?.replace(/\/+$/, "");
        const key = process.env.EVOLUTION_API_KEY;
        if (!base || !key) throw new Error("EVOLUTION_CONFIG_MISSING");
        const url = `${base}/settings`;
        const headers = { apikey: key, "Content-Type": "application/json" };
        const response = await fetch(
          `${url}/find/${encodeURIComponent(project.instanceName)}`,
          { headers, signal: AbortSignal.timeout(5000) },
        );
        if (!response.ok) throw new Error(`SETTINGS_HTTP_${response.status}`);
        const raw = record(await response.json());
        const outer = raw.settings ? record(raw.settings) : raw;
        const current = outer.settings ? record(outer.settings) : outer;
        const getBoolean = (camel: string, snake: string) => {
          const value = current[camel] ?? current[snake];
          if (typeof value !== "boolean")
            throw new Error("SETTINGS_RESPONSE_INVALID");
          return value;
        };
        const rejectCall = getBoolean("rejectCall", "reject_call");
        const msgCall = current.msgCall ?? current.msg_call;
        if (rejectCall && typeof msgCall !== "string")
          throw new Error("SETTINGS_RESPONSE_INVALID");
        const payload = {
          rejectCall,
          msgCall: typeof msgCall === "string" ? msgCall : "",
          groupsIgnore: getBoolean("groupsIgnore", "groups_ignore"),
          readStatus: getBoolean("readStatus", "read_status"),
          syncFullHistory: getBoolean("syncFullHistory", "sync_full_history"),
          alwaysOnline: project.whatsappAlwaysOnline,
          readMessages: project.whatsappReadMessages,
        };
        const saved = await fetch(
          `${url}/set/${encodeURIComponent(project.instanceName)}`,
          {
            method: "POST",
            headers,
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(5000),
          },
        );
        if (!saved.ok) throw new Error(`SETTINGS_HTTP_${saved.status}`);
        await tx.project.update({
          where: { id: project.id },
          data: { whatsappSettingsPending: false, whatsappSettingsError: null },
        });
      },
      { maxWait: 15000, timeout: 15000 },
    );
  } catch (error) {
    const code =
      error instanceof Error && /^[A-Z_0-9]+$/.test(error.message)
        ? error.message
        : "SETTINGS_SYNC_FAILED";
    await prisma.project.updateMany({
      where: { id: candidate.id, whatsappSettingsPending: true },
      data: {
        whatsappSyncAfter: new Date(Date.now() + 60000),
        whatsappSettingsError: code,
      },
    });
  }
}
