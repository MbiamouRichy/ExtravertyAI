"use server";

import { getSession } from "@/lib/auth-server";
import { stripe } from "@/lib/stripe";
import prisma from "@/lib/prisma";

// On ajoute 'projectId' en paramètre
export async function createCheckoutSession(
  priceId: string,
  projectId: string,
) {
  try {
    if (!priceId) throw new Error("Price ID manquant.");
    if (!projectId) throw new Error("Project ID manquant.");

    const session = await getSession();
    if (!session?.user?.id) throw new Error("Non autorisé");

    // SÉCURITÉ : Vérifier que l'utilisateur a bien les droits OWNER ou ADMIN sur CE projet
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
        return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/${projectId}/settings`,
      });
      return { url: stripeSession.url };
    }

    // Création du lien de paiement
    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      customer: customerId,
      customer_email: customerId ? undefined : session.user.email || undefined,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/${projectId}?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/${projectId}?canceled=true`,
      metadata: {
        projectId: project.id, // CRUCIAL : C'est ce que lira le webhook
      },
    });

    return { url: checkoutSession.url };
  } catch (error) {
    console.error("Erreur Checkout:", error);
    throw new Error("Impossible de générer la session de paiement.");
  }
}
