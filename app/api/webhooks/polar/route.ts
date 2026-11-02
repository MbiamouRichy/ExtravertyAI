import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { syncPolarSubscription } from "@/lib/billing-polar";
import { getPolarSubscription } from "@/lib/polar";
import { verifyWebhookSignature } from "@/lib/standard-webhook";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const secret = process.env.POLAR_WEBHOOK_SECRET;
  if (!secret) return new NextResponse("Webhook unavailable", { status: 503 });
  const body = await req.text();
  const timestamp = req.headers.get("webhook-timestamp");
  const valid = verifyWebhookSignature({
    secret,
    body,
    id: req.headers.get("webhook-id"),
    timestamp,
    signature: req.headers.get("webhook-signature"),
  });
  if (!valid) return new NextResponse("Invalid signature", { status: 400 });
  try {
    const event = JSON.parse(body) as {
      type?: string;
      data?: { id?: string; subscription_id?: string | null };
    };
    // Une commande désigne l'abonnement par subscription_id ; un achat unique n'en a pas.
    const subscriptionId = event.type?.startsWith("subscription.")
      ? event.data?.id
      : event.type?.startsWith("order.")
        ? event.data?.subscription_id
        : undefined;
    if (subscriptionId) {
      // L'état relu chez Polar rend les doublons et le désordre sans effet.
      const subscription = await getPolarSubscription(subscriptionId);
      await syncPolarSubscription(prisma, subscription, Number(timestamp));
      await prisma.project.updateMany({
        where: { stripeSubscriptionId: subscription.id },
        data: { billingNextCheckAt: new Date() },
      });
    }
    return new NextResponse("OK");
  } catch {
    console.error("[polar] Synchronisation non confirmée.");
    return new NextResponse("Retry required", { status: 503 });
  }
}
