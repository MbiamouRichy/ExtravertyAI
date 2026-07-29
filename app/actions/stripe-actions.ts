"use server";

import { getSession } from "@/lib/auth-server";
import { stripe } from "@/lib/stripe";
import prisma from "@/lib/prisma";

export async function createCheckoutSession(
  priceId: string,
  projectId: string,
) {
  try {
    if (!priceId) throw new Error("Price ID manquant.");
    if (!projectId) throw new Error("Project ID manquant.");

    const session = await getSession();
    if (!session?.user?.id) throw new Error("Non autorisé");

    // SÉCURITÉ : Vérifier les droits
    const membership = await prisma.projectMembership.findUnique({
      where: {
        userId_projectId: { userId: session.user.id, projectId: projectId },
      },
    });

    if (!membership || membership.role === "USER") {
      throw new Error("Droits insuffisants pour abonner ce projet.");
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) throw new Error("Projet introuvable");

    const customerId = project.stripeCustomerId || undefined;

    // Redirection vers le portail de facturation si déjà abonné
    if (customerId && project.stripeSubscriptionId) {
      const stripeSession = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/projects/${projectId}`,
      });
      return { url: stripeSession.url };
    }

    // Création du lien de paiement avec l'essai gratuit
    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      customer: customerId,
      customer_email: customerId ? undefined : session.user.email || undefined,
      line_items: [{ price: priceId, quantity: 1 }],

      // --- AJOUTS POUR LE TRIAL DE 10 JOURS ---
      payment_method_collection: "always", // OBLIGE la saisie de la carte même à 0€
      subscription_data: {
        trial_period_days: 10, // Définit les 10 jours d'essai
        metadata: {
          projectId: project.id, // CRUCIAL : Sauvegarde l'ID du projet dans l'abonnement
        },
      },
      // ---------------------------------------

      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/projects/${projectId}?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/projects?canceled=true`,
      metadata: {
        projectId: project.id, // Pour la session
      },
    });

    return { url: checkoutSession.url };
  } catch (error) {
    console.error("Erreur Checkout:", error);
    throw new Error("Impossible de générer la session de paiement.");
  }
}
