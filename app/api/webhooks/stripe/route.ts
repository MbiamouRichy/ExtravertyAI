import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import prisma from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

// Utilisation de `type` avec `&` au lieu de `interface extends` pour éviter les conflits
type ExtendedSubscription = Stripe.Subscription & {
  current_period_end: number;
  trial_end: number | null;
};

type ExtendedInvoice = Stripe.Invoice & {
  subscription: string | Stripe.Subscription | null;
};

export async function POST(req: Request) {
  const body = await req.text();
  const headersList = await headers();
  const signature = headersList.get("Stripe-Signature");

  if (!signature) {
    return new NextResponse("Missing Stripe Signature", { status: 400 });
  }

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
        const session = event.data.object as Stripe.Checkout.Session;
        const projectId = session.metadata?.projectId;

        if (!projectId) {
          console.error(
            "❌ 'projectId' manquant dans les métadonnées de la session.",
          );
          break;
        }

        if (!session.subscription) break;

        const subscription = await stripe.subscriptions.retrieve(
          session.subscription as string,
        );

        const sub = subscription as unknown as ExtendedSubscription;
        const projectStatus = sub.status === "trialing" ? "trialing" : "active";

        const currentPeriodEnd =
          sub.current_period_end ||
          sub.trial_end ||
          Math.floor(Date.now() / 1000);

        const customerId =
          typeof sub.customer === "string" ? sub.customer : sub.customer?.id;

        await prisma.project.update({
          where: { id: projectId },
          data: {
            status: projectStatus,
            stripeCustomerId: customerId,
            stripeSubscriptionId: sub.id,
            stripePriceId: sub.items?.data[0]?.price?.id,
            stripeCurrentPeriodEnd: new Date(currentPeriodEnd * 1000),
            expiredAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
          },
        });

        console.log(`✅ [Stripe] Checkout complet pour le projet ${projectId}`);
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as unknown as ExtendedInvoice;
        const rawSubscription = invoice.subscription;

        if (!rawSubscription) break;

        const subIdString =
          typeof rawSubscription === "string"
            ? rawSubscription
            : rawSubscription.id;

        const projectExists = await prisma.project.findUnique({
          where: { stripeSubscriptionId: subIdString },
          select: { id: true },
        });

        if (!projectExists) {
          console.warn(
            `⏳ [Stripe] Invoice traitée avant le checkout. Ignoré. ID: ${subIdString}`,
          );
          break;
        }

        const subscription = await stripe.subscriptions.retrieve(subIdString);
        const sub = subscription as unknown as ExtendedSubscription;

        const currentPeriodEnd =
          sub.current_period_end ||
          sub.trial_end ||
          Math.floor(Date.now() / 1000);

        await prisma.project.update({
          where: { stripeSubscriptionId: sub.id },
          data: {
            status: "active",
            stripePriceId: sub.items?.data[0]?.price?.id,
            stripeCurrentPeriodEnd: new Date(currentPeriodEnd * 1000),
            expiredAt: null,
          },
        });
        break;
      }

      case "customer.subscription.updated": {
        const subEvent = event.data.object as unknown as ExtendedSubscription;

        const projectExists = await prisma.project.findUnique({
          where: { stripeSubscriptionId: subEvent.id },
          select: { id: true },
        });

        if (!projectExists) break;

        let newStatus: "trialing" | "active" | "paused" | "inactive" = "active";

        if (subEvent.status === "trialing") newStatus = "trialing";
        if (subEvent.status === "past_due" || subEvent.status === "unpaid") {
          newStatus = "paused";
        }
        if (subEvent.status === "canceled") {
          newStatus = "inactive";
        }

        const currentPeriodEnd =
          subEvent.current_period_end ||
          subEvent.trial_end ||
          Math.floor(Date.now() / 1000);

        await prisma.project.update({
          where: { stripeSubscriptionId: subEvent.id },
          data: {
            status: newStatus,
            stripePriceId: subEvent.items?.data[0]?.price?.id,
            stripeCurrentPeriodEnd: new Date(currentPeriodEnd * 1000),
          },
        });
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;

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
        console.log(`ℹ️ [Stripe] Événement ignoré : ${event.type}`);
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
