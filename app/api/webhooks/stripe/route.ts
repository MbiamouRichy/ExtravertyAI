import { NextResponse } from "next/server";
import type Stripe from "stripe";
import prisma from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { syncSubscription } from "@/lib/billing-quota";

export const runtime = "nodejs";
export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !secret)
    return new NextResponse("Webhook unavailable", { status: 400 });
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await req.text(), signature, secret);
  } catch {
    return new NextResponse("Invalid signature", { status: 400 });
  }
  try {
    let subscriptionId: string | undefined;
    let projectId: string | undefined;
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id;
      projectId = session.metadata?.projectId;
    } else if (
      [
        "customer.subscription.updated",
        "customer.subscription.deleted",
        "customer.subscription.created",
      ].includes(event.type)
    ) {
      subscriptionId = (event.data.object as Stripe.Subscription).id;
    } else if (
      [
        "invoice.payment_succeeded",
        "invoice.paid",
        "invoice.payment_failed",
      ].includes(event.type)
    ) {
      const invoice = event.data.object as Stripe.Invoice;
      const subscription = invoice.parent?.subscription_details?.subscription;
      subscriptionId =
        typeof subscription === "string" ? subscription : subscription?.id;
    }
    if (subscriptionId) {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
        expand: ["latest_invoice"],
      });
      await syncSubscription(prisma, subscription, event.created, projectId);
    }
    return new NextResponse("OK");
  } catch {
    console.error("[stripe] Synchronisation non confirmée.");
    return new NextResponse("Retry required", { status: 503 });
  }
}
