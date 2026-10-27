import "server-only";
import prisma from "./prisma";
import { deleteProjectMedia } from "./chat-media-cleanup";
import { forgetProjectNotifications } from "./notifications";
import { stripe } from "./stripe";
import { markProjectForDeletion, SettingsError } from "./project-settings";
import { deleteEvolutionInstance } from "@/app/actions/evolutionAPI";

/** Étape de nettoyage externe où une suppression s'est arrêtée. */
export type DeletionStep = "billing" | "whatsapp" | "media";

/**
 * Suppression commencée mais interrompue : le projet reste en pause, marqué
 * « en cours de suppression ». Relancer la suppression reprend où elle s'est
 * arrêtée, chaque étape étant idempotente.
 */
export class ProjectDeletionError extends SettingsError {
  constructor(
    message: string,
    readonly step: DeletionStep,
  ) {
    super(message);
  }
}

// Une instance connectée est d'abord déconnectée par Evolution : le premier
// appel dépasse souvent le délai, le second trouve l'instance fermée.
async function deleteInstanceWithRetry(instanceName: string) {
  try {
    await deleteEvolutionInstance(instanceName);
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await deleteEvolutionInstance(instanceName);
  }
}

// Shared by project deletion and verified account deletion. Provider references
// remain available until both external cleanup steps have been confirmed.
export async function deleteProjectResources(
  projectId: string,
  actorId: string,
) {
  const project = await prisma.$transaction((tx) =>
    markProjectForDeletion(tx, projectId, actorId),
  );
  if (project.stripeSubscriptionId) {
    try {
      const options = { timeout: 10000, maxNetworkRetries: 1 };
      const subscription = await stripe.subscriptions.retrieve(
        project.stripeSubscriptionId,
        {},
        options,
      );
      if (subscription.status !== "canceled")
        await stripe.subscriptions.cancel(
          project.stripeSubscriptionId,
          {},
          options,
        );
    } catch {
      throw new ProjectDeletionError(
        "Annulation de la facturation impossible. Le projet est conservé en pause ; réessayez.",
        "billing",
      );
    }
  }
  if (project.stripeCustomerId) {
    // Erases the customer's personal data at Stripe (name, e-mail, payment
    // methods). Invoices and payments remain in Stripe for legal retention.
    try {
      await stripe.customers.del(
        project.stripeCustomerId,
        {},
        { timeout: 10000, maxNetworkRetries: 1 },
      );
    } catch (error) {
      // Already deleted on a previous attempt: nothing left to erase.
      if ((error as { code?: string }).code !== "resource_missing")
        throw new ProjectDeletionError(
          "Suppression des données de facturation impossible. Le projet est conservé en pause ; réessayez.",
          "billing",
        );
    }
  }
  if (project.instanceName) {
    try {
      await deleteInstanceWithRetry(project.instanceName);
    } catch {
      throw new ProjectDeletionError(
        "Le serveur WhatsApp n’a pas confirmé la déconnexion. L’abonnement est déjà résilié ; terminez la suppression dans quelques instants.",
        "whatsapp",
      );
    }
  }
  try {
    // Pièces jointes, icône, PDF de connaissances et tout fichier compté dans
    // le quota de stockage : supprimés de MinIO avant la base.
    await deleteProjectMedia(projectId, { db: prisma });
  } catch {
    throw new ProjectDeletionError(
      "Suppression des fichiers impossible. L’abonnement et WhatsApp sont déjà supprimés ; terminez la suppression dans quelques instants.",
      "media",
    );
  }
  // La base suit en cascade (messages, sources, registre des fichiers…) ; les
  // lectures de notifications, sans clé étrangère, sont effacées avec elle.
  await prisma.$transaction([
    forgetProjectNotifications(prisma, projectId),
    prisma.project.delete({ where: { id: projectId } }),
  ]);
}
