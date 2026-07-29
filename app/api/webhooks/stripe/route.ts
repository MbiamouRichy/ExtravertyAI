import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import prisma from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

// Mise à jour des interfaces pour inclure le statut et le trial
interface CustomSession {
  metadata?: { projectId?: string };
  subscription?: string;
}

interface CustomInvoice {
  subscription?: string;
  status: string;
}

interface CustomSubscription {
  id: string;
  customer: string;
  status: string; // 'trialing', 'active', 'past_due', 'canceled'
  trial_end: number | null;
  current_period_end: number;
  items: { data: { price: { id: string } }[] };
  metadata?: { projectId?: string };
}

export async function POST(req: Request) {
  const body = await req.text();
  const headersList = await headers();
  const signature = headersList.get("Stripe-Signature") as string;

  let event: Stripe.Event;

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

  try {
    switch (event.type) {
      // A. Nouvel Abonnement (Début de l'essai de 10 jours)
      case "checkout.session.completed": {
        const session = event.data.object as unknown as CustomSession;
        const projectId = session.metadata?.projectId;

        if (!projectId) {
          throw new Error("Alerte: 'projectId' manquant.");
        }

        const subscription = (await stripe.subscriptions.retrieve(
          session.subscription as string,
        )) as unknown as CustomSubscription;

        // Détermine le statut Prisma en fonction du statut Stripe
        const projectStatus =
          subscription.status === "trialing" ? "trialing" : "active";

        await prisma.project.update({
          where: { id: projectId },
          data: {
            status: projectStatus,
            stripeCustomerId: subscription.customer,
            stripeSubscriptionId: subscription.id,
            stripePriceId: subscription.items.data[0].price.id,
            stripeCurrentPeriodEnd: new Date(
              subscription.current_period_end * 1000,
            ),
            // On sauvegarde la date de fin d'essai si elle existe
            expiredAt: subscription.trial_end
              ? new Date(subscription.trial_end * 1000)
              : null,
          },
        });
        break;
      }

      // B. Fin de l'essai ou Renouvellement (La carte est enfin débitée)
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
            status: "active", // L'argent est passé, le projet passe officiellement en production
            stripePriceId: subscription.items.data[0].price.id,
            stripeCurrentPeriodEnd: new Date(
              subscription.current_period_end * 1000,
            ),
            expiredAt: null, // Plus d'expiration d'essai
          },
        });
        break;
      }

      // C. Mise à jour de l'abonnement (Gère si la carte échoue à la fin des 10 jours)
      case "customer.subscription.updated": {
        const subEvent = event.data.object as unknown as CustomSubscription;

        const subscription = (await stripe.subscriptions.retrieve(
          subEvent.id,
        )) as unknown as CustomSubscription;

        // Mappage des statuts Stripe vers votre enum Prisma ProjectStatus
        let newStatus: "trialing" | "active" | "paused" | "inactive" = "active";
        if (subscription.status === "trialing") newStatus = "trialing";
        if (
          subscription.status === "past_due" ||
          subscription.status === "unpaid"
        )
          newStatus = "paused";
        if (subscription.status === "canceled") newStatus = "inactive";

        await prisma.project.update({
          where: { stripeSubscriptionId: subscription.id },
          data: {
            status: newStatus,
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

        await prisma.project.update({
          where: { stripeSubscriptionId: subscription.id },
          data: {
            status: "inactive",
            stripeSubscriptionId: null,
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
