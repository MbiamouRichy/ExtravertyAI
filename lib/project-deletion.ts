import "server-only";
import prisma from "./prisma";
import { deleteProjectMedia } from "./chat-media-cleanup";
import { forgetProjectNotifications } from "./notifications";
import { stripe } from "./stripe";
import { markProjectForDeletion, SettingsError } from "./project-settings";
import { deleteEvolutionInstance } from "@/app/actions/evolutionAPI";

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
      throw new SettingsError(
        "Annulation de la facturation impossible. Le projet est conservé en pause ; réessayez.",
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
        throw new SettingsError(
          "Suppression des données de facturation impossible. Le projet est conservé en pause ; réessayez.",
        );
    }
  }
  if (project.instanceName) {
    try {
      await deleteEvolutionInstance(project.instanceName);
    } catch {
      throw new SettingsError(
        "Suppression de la connexion WhatsApp impossible. Le projet est conservé en pause ; réessayez.",
      );
    }
  }
  try {
    // Pièces jointes, icône, PDF de connaissances et tout fichier compté dans
    // le quota de stockage : supprimés de MinIO avant la base.
    await deleteProjectMedia(projectId, { db: prisma });
  } catch {
    throw new SettingsError(
      "Suppression des médias impossible. Le projet reste en pause ; réessayez.",
    );
  }
  // La base suit en cascade (messages, sources, registre des fichiers…) ; les
  // lectures de notifications, sans clé étrangère, sont effacées avec elle.
  await prisma.$transaction([
    forgetProjectNotifications(prisma, projectId),
    prisma.project.delete({ where: { id: projectId } }),
  ]);
}
