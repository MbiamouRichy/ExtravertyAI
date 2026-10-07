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
  writeProjectPause,
} from "@/lib/project-settings";
import { notifyChatChanged } from "@/lib/chat-realtime";
import { stripe } from "@/lib/stripe";
import { syncWhatsAppSettings } from "@/lib/whatsapp-settings-sync";

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
    await syncWhatsAppSettings(prisma, parsed.projectId);
    const state = await prisma.project.findUniqueOrThrow({
      where: { id: parsed.projectId },
      select: { whatsappSettingsPending: true },
    });
    invalidate(parsed.projectId);
    return {
      success: true as const,
      version,
      pending: state.whatsappSettingsPending,
    };
  } catch (error) {
    return { success: false as const, error: publicError(error) };
  }
}
export async function openProjectBillingPortal(
  projectId: string,
  intent: "manage" | "renew" | "upgrade" = "manage",
) {
  try {
    Id.parse(projectId);
    z.enum(["manage", "renew", "upgrade"]).parse(intent);
    const userId = await actor();
    const { project } = await prisma.$transaction((tx) =>
      requireProjectAdmin(tx, projectId, userId, true),
    );
    if (project.deletionPending)
      throw new SettingsError("Ce projet est en cours de suppression.");
    if (!project.stripeCustomerId)
      throw new SettingsError(
        "La facturation n’est pas encore activée. Terminez votre inscription ou réessayez après confirmation du paiement.",
      );
    const origin = process.env.NEXT_PUBLIC_APP_URL;
    if (!origin)
      throw new SettingsError("Le portail de facturation n’est pas configuré.");
    const subscription = project.stripeSubscriptionId
      ? await stripe.subscriptions.retrieve(
          project.stripeSubscriptionId,
          { expand: ["latest_invoice"] },
          { timeout: 10000, maxNetworkRetries: 0 },
        )
      : null;
    if (
      subscription &&
      (typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer.id) !== project.stripeCustomerId
    )
      throw new SettingsError("L’abonnement n’a pas pu être vérifié.");
    const invoice = subscription?.latest_invoice;
    if (
      intent === "renew" &&
      invoice &&
      typeof invoice !== "string" &&
      invoice.status === "open" &&
      invoice.hosted_invoice_url
    ) {
      const url = new URL(invoice.hosted_invoice_url);
      if (url.protocol === "https:" && url.hostname === "invoice.stripe.com")
        return { success: true as const, url: url.href };
    }
    if (
      intent === "upgrade" &&
      (!subscription || !["active", "trialing"].includes(subscription.status))
    )
      throw new SettingsError(
        "Régularisez ou renouvelez l’abonnement avant de changer d’offre.",
      );
    if (intent === "upgrade" && subscription) {
      const priceIds = ["STARTER", "PRO", "BUSINESS"]
        .map((plan) => process.env["STRIPE_" + plan + "_PLAN_ID"])
        .filter((id): id is string => !!id);
      const prices = await Promise.all(
        priceIds.map((id) =>
          stripe.prices.retrieve(
            id,
            {},
            { timeout: 10000, maxNetworkRetries: 0 },
          ),
        ),
      );
      const current = subscription.items.data[0]?.price;
      if (
        !current ||
        !prices.some(
          (price) =>
            price.active &&
            price.currency === current.currency &&
            price.id !== current.id,
        )
      )
        throw new SettingsError(
          "Aucune autre offre n’est encore disponible dans la devise de cet abonnement. Contactez-nous pour préparer le changement de devise.",
        );
    }
    const portal = await stripe.billingPortal.sessions.create({
      customer: project.stripeCustomerId,
      locale: "fr",
      ...(intent === "upgrade" && subscription
        ? {
            flow_data: {
              type: "subscription_update" as const,
              subscription_update: { subscription: subscription.id },
              after_completion: {
                type: "redirect" as const,
                redirect: {
                  return_url: origin + "/projects/" + project.id + "/billing",
                },
              },
            },
          }
        : {}),
      return_url: `${origin}/projects/${project.id}/billing`,
    });
    return { success: true as const, url: portal.url };
  } catch (error) {
    return { success: false as const, error: publicError(error) };
  }
}

export async function setProjectPaused(input: unknown) {
  try {
    const parsed = z
      .object({ projectId: Id, expectedVersion: Version, paused: z.boolean() })
      .parse(input);
    const userId = await actor();
    const result = await prisma.$transaction((tx) =>
      writeProjectPause(
        tx,
        parsed.projectId,
        userId,
        parsed.expectedVersion,
        parsed.paused,
      ),
    );
    invalidate(parsed.projectId);
    await notifyChatChanged(parsed.projectId);
    return { success: true as const, ...result };
  } catch (error) {
    return { success: false as const, error: publicError(error) };
  }
}
