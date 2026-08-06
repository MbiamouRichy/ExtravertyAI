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
  status: string;
  trial_end: number | null;
  current_period_end?: number; // Rendu optionnel pour éviter le crash
  billing_cycle_anchor?: number; // Ajout du fallback
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
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Erreur de signature";
    console.error("⚠️ Erreur Webhook (Signature):", errorMessage);
    return new NextResponse(`Webhook Error: ${errorMessage}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as unknown as CustomSession;
        const projectId = session.metadata?.projectId;

        if (!projectId) {
          console.error(
            "❌ 'projectId' manquant dans les métadonnées de la session.",
          );
          break;
        }

        const subscription = (await stripe.subscriptions.retrieve(
          session.subscription as string,
        )) as unknown as CustomSubscription;

        const projectStatus =
          subscription.status === "trialing" ? "trialing" : "active";
        console.log("Stripe Sub:", subscription);

        // 🔒 Sécurisation de la date de fin de période
        const currentPeriodEnd =
          subscription.current_period_end ||
          subscription.trial_end ||
          subscription.billing_cycle_anchor ||
          Math.floor(Date.now() / 1000);

        await prisma.project.update({
          where: { id: projectId },
          data: {
            status: projectStatus,
            stripeCustomerId: subscription.customer,
            stripeSubscriptionId: subscription.id,
            stripePriceId: subscription.items.data[0].price.id,
            stripeCurrentPeriodEnd: new Date(currentPeriodEnd * 1000),
            expiredAt: subscription.trial_end
              ? new Date(subscription.trial_end * 1000)
              : null,
          },
        });
        console.log(`✅ [Stripe] Checkout complet pour le projet ${projectId}`);
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as unknown as CustomInvoice;
        const subscriptionId = invoice.subscription;

        if (!subscriptionId) break;

        const projectExists = await prisma.project.findUnique({
          where: { stripeSubscriptionId: subscriptionId },
          select: { id: true },
        });

        if (!projectExists) {
          console.warn(
            `⏳ [Stripe] Invoice traitée avant le checkout. Ignoré (Race Condition évitée). ID: ${subscriptionId}`,
          );
          break;
        }

        const subscription = (await stripe.subscriptions.retrieve(
          subscriptionId,
        )) as unknown as CustomSubscription;

        // 🔒 Sécurisation
        const currentPeriodEnd =
          subscription.current_period_end ||
          subscription.trial_end ||
          subscription.billing_cycle_anchor ||
          Math.floor(Date.now() / 1000);

        await prisma.project.update({
          where: { stripeSubscriptionId: subscription.id },
          data: {
            status: "active",
            stripePriceId: subscription.items.data[0].price.id,
            stripeCurrentPeriodEnd: new Date(currentPeriodEnd * 1000),
            expiredAt: null,
          },
        });
        break;
      }

      case "customer.subscription.updated": {
        const subEvent = event.data.object as unknown as CustomSubscription;

        const projectExists = await prisma.project.findUnique({
          where: { stripeSubscriptionId: subEvent.id },
          select: { id: true },
        });

        if (!projectExists) break;

        const subscription = (await stripe.subscriptions.retrieve(
          subEvent.id,
        )) as unknown as CustomSubscription;

        let newStatus: "trialing" | "active" | "paused" | "inactive" = "active";
        if (subscription.status === "trialing") newStatus = "trialing";
        if (
          subscription.status === "past_due" ||
          subscription.status === "unpaid"
        )
          newStatus = "paused";
        if (subscription.status === "canceled") newStatus = "inactive";

        // 🔒 Sécurisation
        const currentPeriodEnd =
          subscription.current_period_end ||
          subscription.trial_end ||
          subscription.billing_cycle_anchor ||
          Math.floor(Date.now() / 1000);

        await prisma.project.update({
          where: { stripeSubscriptionId: subscription.id },
          data: {
            status: newStatus,
            stripePriceId: subscription.items.data[0].price.id,
            stripeCurrentPeriodEnd: new Date(currentPeriodEnd * 1000),
          },
        });
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as unknown as CustomSubscription;

        try {
          await prisma.project.update({
            where: { stripeSubscriptionId: subscription.id },
            data: {
              status: "inactive",
              stripeSubscriptionId: null,
              stripePriceId: null,
            },
          });
        } catch {
          console.warn(
            "⚠️ [Stripe] Tentative d'annulation d'un abonnement inconnu en BDD.",
          );
        }
        break;
      }

      default:
        console.log(`ℹ️ [Stripe] Événement non traité : ${event.type}`);
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Erreur inconnue";
    console.error(
      `❌ [Stripe] Erreur interne lors du traitement de ${event.type}:`,
      errorMessage,
    );
  }

  return new NextResponse("OK", { status: 200 });
}
