import "server-only";
import prisma from "./prisma";
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
  if (project.instanceName) {
    try {
      await deleteEvolutionInstance(project.instanceName);
    } catch {
      throw new SettingsError(
        "Suppression de la connexion WhatsApp impossible. Le projet est conservé en pause ; réessayez.",
      );
    }
  }
  await prisma.project.delete({ where: { id: projectId } });
}
