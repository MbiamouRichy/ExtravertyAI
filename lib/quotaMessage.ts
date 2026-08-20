import prisma from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

export async function processWhatsAppMessage(projectId: string) {
  // 1. On incrémente UNIQUEMENT la consommation actuelle (messageCount)
  const project = await prisma.project.update({
    where: { id: projectId },
    data: {
      messageCount: { increment: 1 },
      // allmessagesCount NE CHANGE PAS, c'est la limite imposée par le plan.
    },
    select: {
      messageCount: true,
      allMessagesCount: true, // On récupère le plafond pour faire la vérification
      status: true,
      stripeSubscriptionId: true,
    },
  });

  // 2. SCÉNARIO A : Phase de test (Limite stricte à 150)
  if (
    project.status === "trialing" &&
    project.messageCount >= 150 &&
    project.stripeSubscriptionId
  ) {
    try {
      console.log(
        `[PROJET ${projectId}] Limite d'essai de 150 atteinte. Déclenchement de la facturation.`,
      );

      await stripe.subscriptions.update(project.stripeSubscriptionId, {
        trial_end: "now",
      });
      // Le webhook passera le projet en 'active' et le paiement mensuel commencera
    } catch (error) {
      console.error("Erreur lors de la facturation anticipée :", error);
    }
  }

  // 3. SCÉNARIO B : Client Actif (Vérification contre allmessagesCount)
  if (
    project.status === "active" &&
    project.messageCount >= project.allMessagesCount
  ) {
    console.log(
      `[PROJET ${projectId}] Quota mensuel de ${project.allMessagesCount} messages atteint.`,
    );

    // Le quota est atteint. Vous devez renvoyer un signal pour dire à n8n
    // ou à votre script de NE PAS envoyer le message WhatsApp.
    return { canSendMessage: false, project };
  }

  // Le message peut être envoyé
  return { canSendMessage: true, project };
}
