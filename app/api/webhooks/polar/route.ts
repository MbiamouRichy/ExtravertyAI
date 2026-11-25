import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { syncPolarSubscription } from "@/lib/billing-polar";
import { syncMessageCreditOrder } from "@/lib/message-credit";
import { getPolarOrder, getPolarSubscription } from "@/lib/polar";
import { readWebhookBody, verifyWebhookSignature } from "@/lib/standard-webhook";

export const runtime = "nodejs";

/**
 * Webhook Polar : rien n'est lu ni appliqué avant la vérification de la
 * signature (secret, horodatage à 5 minutes près, comparaison en temps
 * constant). Le contenu reçu ne sert qu'à savoir quoi relire : l'abonnement
 * ou la commande est toujours relu chez Polar, ce qui rend les doublons, le
 * désordre et un rejeu sans effet.
 */
export async function POST(req: Request) {
  const secret = process.env.POLAR_WEBHOOK_SECRET;
  if (!secret) return new NextResponse("Webhook unavailable", { status: 503 });
  const body = await readWebhookBody(req);
  if (body === null) return new NextResponse("Payload too large", { status: 413 });
  const timestamp = req.headers.get("webhook-timestamp");
  const valid = verifyWebhookSignature({
    secret,
    body,
    id: req.headers.get("webhook-id"),
    timestamp,
    signature: req.headers.get("webhook-signature"),
  });
  if (!valid) return new NextResponse("Invalid signature", { status: 400 });
  let event: { type?: unknown; data?: { id?: unknown; subscription_id?: unknown } | null };
  try {
    event = JSON.parse(body);
  } catch {
    // Signé mais illisible : le renvoyer ne changerait rien.
    return new NextResponse("Invalid payload", { status: 400 });
  }
  if (!event || typeof event !== "object" || typeof event.type !== "string")
    return new NextResponse("Invalid payload", { status: 400 });
  const type = event.type;
  const text = (value: unknown) =>
    typeof value === "string" && value.length > 0 && value.length <= 200 ? value : undefined;
  const dataId = text(event.data?.id);
  const dataSubscriptionId = text(event.data?.subscription_id);
  try {
    // Une commande désigne l'abonnement par subscription_id ; un achat unique n'en a pas.
    const subscriptionId = type.startsWith("subscription.")
      ? dataId
      : type.startsWith("order.")
        ? dataSubscriptionId
        : undefined;
    // Achat unique : une recharge de messages, relue chez Polar avant d'être créditée.
    const creditOrderId =
      type.startsWith("order.") && !event.data?.subscription_id ? dataId : undefined;
    if (creditOrderId) {
      await syncMessageCreditOrder(prisma, await getPolarOrder(creditOrderId));
    }
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
