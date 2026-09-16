"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth-server";
import prisma from "@/lib/prisma";
import { AgentConfigSchema } from "@/lib/agent-config";
import {
  SettingsError,
  requireProjectAdmin,
  writeAgentConfig,
} from "@/lib/project-settings";
import { notifyChatChanged } from "@/lib/chat-realtime";
import { stripe } from "@/lib/stripe";

const Id = z.string().cuid();
const Version = z.number().int().nonnegative();
function publicError(error: unknown) {
  return error instanceof SettingsError
    ? error.message
    : error instanceof z.ZodError
      ? error.issues[0]?.message || "Données invalides."
      : "L’opération n’a pas été confirmée. Réessayez après actualisation.";
}
async function actor() {
  const session = await getSession();
  if (!session?.user?.id) throw new SettingsError("Connexion requise.");
  return session.user.id;
}
function invalidate(projectId: string) {
  revalidatePath(`/projects/${projectId}`, "layout");
  revalidatePath("/projects");
}
export async function saveAgentConfiguration(input: unknown) {
  try {
    const parsed = z
      .object({
        projectId: Id,
        expectedVersion: Version,
        config: AgentConfigSchema,
      })
      .parse(input);
    const userId = await actor();
    const version = await prisma.$transaction((tx) =>
      writeAgentConfig(
        tx,
        parsed.projectId,
        userId,
        parsed.expectedVersion,
        parsed.config,
      ),
    );
    invalidate(parsed.projectId);
    await notifyChatChanged(parsed.projectId);
    return { success: true as const, version };
  } catch (error) {
    return { success: false as const, error: publicError(error) };
  }
}
export async function saveProjectPreferences(input: unknown) {
  try {
    const parsed = z
      .object({
        projectId: Id,
        expectedVersion: Version,
        name: z.string().trim().min(2).max(100),
        automationPaused: z.boolean(),
      })
      .parse(input);
    const userId = await actor();
    const version = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM project WHERE id = ${parsed.projectId} FOR UPDATE`;
      const { project } = await requireProjectAdmin(
        tx,
        parsed.projectId,
        userId,
      );
      if (project.deletionPending)
        throw new SettingsError("Ce projet est en cours de suppression.");
      if (project.settingsVersion !== parsed.expectedVersion)
        throw new SettingsError("Les réglages ont changé. Actualisez la page.");
      const version = project.settingsVersion + 1;
      await tx.project.update({
        where: { id: project.id },
        data: {
          name: parsed.name,
          automationPaused: parsed.automationPaused,
          settingsVersion: version,
          agentConfigVersion: { increment: 1 },
        },
      });
      await tx.settingsAudit.create({
        data: {
          projectId: project.id,
          actorId: userId,
          action: "project.updated",
          version,
        },
      });
      return version;
    });
    invalidate(parsed.projectId);
    await notifyChatChanged(parsed.projectId);
    return { success: true as const, version };
  } catch (error) {
    return { success: false as const, error: publicError(error) };
  }
}
export async function saveWhatsAppPreferences(input: unknown) {
  try {
    const parsed = z
      .object({
        projectId: Id,
        expectedVersion: Version,
        alwaysOnline: z.boolean(),
        readMessages: z.boolean(),
        typing: z.boolean(),
      })
      .parse(input);
    const userId = await actor();
    const version = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM project WHERE id = ${parsed.projectId} FOR UPDATE`;
      const { project } = await requireProjectAdmin(
        tx,
        parsed.projectId,
        userId,
      );
      if (project.deletionPending)
        throw new SettingsError("Ce projet est en cours de suppression.");
      if (project.settingsVersion !== parsed.expectedVersion)
        throw new SettingsError("Les réglages ont changé. Actualisez la page.");
      const version = project.settingsVersion + 1;
      await tx.project.update({
        where: { id: project.id },
        data: {
          whatsappAlwaysOnline: parsed.alwaysOnline,
          whatsappReadMessages: parsed.readMessages,
          whatsappTyping: parsed.typing,
          whatsappSettingsPending: true,
          whatsappSettingsError: null,
          whatsappSyncAfter: new Date(),
          settingsVersion: version,
        },
      });
      await tx.settingsAudit.create({
        data: {
          projectId: project.id,
          actorId: userId,
          action: "whatsapp.updated",
          version,
        },
      });
      return version;
    });
    invalidate(parsed.projectId);
    return { success: true as const, version };
  } catch (error) {
    return { success: false as const, error: publicError(error) };
  }
}
export async function openProjectBillingPortal(projectId: string) {
  try {
    Id.parse(projectId);
    const userId = await actor();
    const { project } = await prisma.$transaction((tx) =>
      requireProjectAdmin(tx, projectId, userId, true),
    );
    if (!project.stripeCustomerId)
      throw new SettingsError(
        "La facturation n’est pas encore activée. Terminez votre inscription ou réessayez après confirmation du paiement.",
      );
    const origin = process.env.NEXT_PUBLIC_APP_URL;
    if (!origin)
      throw new SettingsError("Le portail de facturation n’est pas configuré.");
    const portal = await stripe.billingPortal.sessions.create({
      customer: project.stripeCustomerId,
      return_url: `${origin}/projects/${project.id}/billing`,
    });
    return { success: true as const, url: portal.url };
  } catch (error) {
    return { success: false as const, error: publicError(error) };
  }
}
