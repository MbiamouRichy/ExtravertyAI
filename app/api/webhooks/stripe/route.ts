import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import prisma from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

// Interfaces personnalisées pour satisfaire TypeScript
interface CustomSession {
  metadata?: { projectId?: string }; // On écoute maintenant le projectId
  subscription?: string;
}

interface CustomInvoice {
  subscription?: string;
}

interface CustomSubscription {
  id: string;
  customer: string;
  current_period_end: number;
  items: { data: { price: { id: string } }[] };
}

export async function POST(req: Request) {
  const body = await req.text();
  const headersList = await headers();
  const signature = headersList.get("Stripe-Signature") as string;

  let event: Stripe.Event;

  // 1. SÉCURITÉ : Vérification de la signature
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Erreur de signature";
    console.error("⚠️ Erreur Webhook:", errorMessage);
    return new NextResponse(`Webhook Error: ${errorMessage}`, { status: 400 });
  }

  // 2. TRAITEMENT DES ÉVÉNEMENTS DU PROJET
  try {
    switch (event.type) {
      // A. Nouvel Abonnement : Fin de la phase de test et passage en production
      case "checkout.session.completed": {
        const session = event.data.object as unknown as CustomSession;
        const projectId = session.metadata?.projectId;

        if (!projectId) {
          throw new Error(
            "Alerte: 'projectId' manquant dans les métadonnées de la session.",
          );
        }

        const subscription = (await stripe.subscriptions.retrieve(
          session.subscription as string,
        )) as unknown as CustomSubscription;

        // On cible la table Project (et non plus User)
        await prisma.project.update({
          where: { id: projectId },
          data: {
            status: "active", // Le client valide sa phase de test, le bot est en prod
            stripeCustomerId: subscription.customer,
            stripeSubscriptionId: subscription.id,
            stripePriceId: subscription.items.data[0].price.id,
            stripeCurrentPeriodEnd: new Date(
              subscription.current_period_end * 1000,
            ),
          },
        });
        break;
      }

      // B. Renouvellement automatique (Le mois suivant est payé)
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as unknown as CustomInvoice;
        const subscriptionId = invoice.subscription;

        if (!subscriptionId) break;

        const subscription = (await stripe.subscriptions.retrieve(
          subscriptionId,
        )) as unknown as CustomSubscription;

        await prisma.project.update({
          where: { stripeSubscriptionId: subscription.id },
          data: {
            status: "active", // Sécurité additionnelle pour garantir le statut
            stripePriceId: subscription.items.data[0].price.id,
            stripeCurrentPeriodEnd: new Date(
              subscription.current_period_end * 1000,
            ),
          },
        });
        break;
      }

      // C. Mise à jour de l'abonnement (Changement de carte, etc.)
      case "customer.subscription.updated": {
        const subEvent = event.data.object as unknown as CustomSubscription;

        const subscription = (await stripe.subscriptions.retrieve(
          subEvent.id,
        )) as unknown as CustomSubscription;

        await prisma.project.update({
          where: { stripeSubscriptionId: subscription.id },
          data: {
            stripePriceId: subscription.items.data[0].price.id,
            stripeCurrentPeriodEnd: new Date(
              subscription.current_period_end * 1000,
            ),
          },
        });
        break;
      }

      // D. Annulation de l'abonnement
      case "customer.subscription.deleted": {
        const subscription = event.data.object as unknown as CustomSubscription;

        // Le client annule : On désactive immédiatement son projet
        await prisma.project.update({
          where: { stripeSubscriptionId: subscription.id },
          data: {
            status: "inactive",
            stripeSubscriptionId: null, // On nettoie l'ID de l'abonnement échu
            stripePriceId: null,
          },
        });
        break;
      }
    }
  } catch (error) {
    console.error("❌ Erreur de base de données dans le Webhook:", error);
    return new NextResponse("Webhook handler failed", { status: 200 });
  }

  return new NextResponse(null, { status: 200 });
}
