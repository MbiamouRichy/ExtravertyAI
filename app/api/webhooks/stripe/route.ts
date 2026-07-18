import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import prisma from "@/lib/prisma";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-06-24.dahlia", // Utilisez votre version actuelle
});

export async function POST(req: Request) {
  const body = await req.text();
  const signature = (await headers().get("Stripe-Signature")) as string;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (error) {
    return new NextResponse("Webhook Error", { status: 400 });
  }

  const session = event.data.object as Stripe.Checkout.Session;

  // 1. Quand l'abonnement est créé ou mis à jour
  if (event.type === "checkout.session.completed") {
    const subscription = await stripe.subscriptions.retrieve(
      session.subscription as string,
    );

    await prisma.user.update({
      where: { id: session.metadata?.userId },
      data: {
        stripeCustomerId: subscription.customer as string,
        stripeSubscriptionId: subscription.id,
        stripePriceId: subscription.items.data[0].price.id,
        stripeCurrentPeriodEnd: new Date(
          subscription.current_period_end * 1000,
        ),
      },
    });
  }

  // 2. Quand l'abonnement est résilié ou échoue
  if (event.type === "invoice.payment_failed") {
    // Logique pour dégrader le compte (ex: remettre en USER ou bloquer)
    await prisma.user.update({
      where: { stripeSubscriptionId: session.subscription as string },
      data: { stripeSubscriptionId: null },
    });
  }

  return new NextResponse(null, { status: 200 });
}
