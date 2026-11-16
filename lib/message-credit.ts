import type { PrismaClient } from "../src/generated/prisma/client";
import type { PolarOrder, PolarProduct } from "./polar";
import {
  EXTRA_PACK_MESSAGES,
  PRICING_PLANS,
  pricingPlan,
  type PlanId,
} from "./pricing";

/**
 * Messages au-delà du quota mensuel. Le projet achète d'avance une recharge
 * chez Polar ; le webhook crédite ce qui a été payé, hors taxes, et chaque
 * message hors quota en retire le prix de l'offre du moment. Le crédit est
 * une somme, pas un nombre de messages : changer d'offre ne le dévalue pas
 * et ne permet pas d'acheter au tarif Business pour envoyer en Starter.
 */

/** Unité du crédit : le dix-millième de dollar. Un centime vaut 100 unités. */
export const CREDIT_UNITS_PER_CENT = 100;
/** Crédit maximal d'avance, en recharges de l'offre : borne les sommes dues en cas de litige. */
export const MAX_CREDIT_PACKS = 10;
/** Métadonnée posée sur le paiement Polar d'une recharge. */
export const CREDIT_ORDER_KIND = "message_credit";

/** Prix d'un message hors quota, en unités de crédit (Starter 80, Pro 60, Business 50). */
export function extraMessageCost(plan: unknown) {
  return (
    (pricingPlan(plan).extraPackCents * CREDIT_UNITS_PER_CENT) /
    EXTRA_PACK_MESSAGES
  );
}

/** Valeur d'une recharge de l'offre, en unités de crédit. */
export function creditPackUnits(plan: unknown) {
  return pricingPlan(plan).extraPackCents * CREDIT_UNITS_PER_CENT;
}

type PeriodUsage = { kind: string; limit: number; used: number; extraUsed: number };
type ProjectCredit = { plan: unknown; extraCredit: number };

/**
 * Messages hors quota encore possibles : seulement sur une période payée (pas
 * pendant l'essai), dans la limite du crédit et de `limit` par période.
 */
export function extraMessagesLeft(
  period: PeriodUsage | null | undefined,
  project: ProjectCredit,
) {
  if (!period || period.kind !== "active") return 0;
  return Math.max(
    0,
    Math.min(
      period.limit - period.extraUsed,
      Math.floor(project.extraCredit / extraMessageCost(project.plan)),
    ),
  );
}

/** Messages encore admissibles sur la période : reste du quota, puis crédit. */
export function messagesLeft(
  period: PeriodUsage | null | undefined,
  project: ProjectCredit,
) {
  if (!period) return 0;
  return Math.max(0, period.limit - period.used) + extraMessagesLeft(period, project);
}

/** Crédit affiché en centimes de dollar, arrondi à l'inférieur. */
export function creditCents(units: number) {
  return Math.floor(units / CREDIT_UNITS_PER_CENT);
}

export function polarCreditProductId(plan: PlanId) {
  return process.env[`POLAR_${plan.toUpperCase()}_CREDIT_PRODUCT_ID`]?.trim() || undefined;
}

function planForCreditProduct(productId: string | null | undefined) {
  if (!productId) return null;
  return PRICING_PLANS.find(({ id }) => polarCreditProductId(id) === productId)?.id ?? null;
}

/** Produit Polar d'une recharge : achat unique, en USD, au prix de l'offre. */
export function matchesPolarCreditProduct(product: PolarProduct, plan: PlanId) {
  const { extraPackCents } = pricingPlan(plan);
  return (
    !product.is_archived &&
    !product.is_recurring &&
    product.prices.some(
      (price) =>
        !price.is_archived &&
        price.amount_type === "fixed" &&
        price.price_currency === "usd" &&
        price.price_amount === extraPackCents,
    )
  );
}

const SETTLED = new Set(["paid", "refunded", "partially_refunded"]);
const cents = (value: unknown) =>
  Number.isSafeInteger(value) && (value as number) >= 0 ? (value as number) : null;

export type CreditSync = "applied" | "ignored" | "pending";

/**
 * Applique une commande Polar de recharge, toujours relue chez Polar (jamais
 * le corps du webhook) : crédit à la première lecture payée, retrait de la
 * part remboursée ensuite. Rejouer ou désordonner les événements est sans
 * effet : une ligne par commande, verrou sur le projet.
 */
export async function syncMessageCreditOrder(
  prisma: PrismaClient,
  order: PolarOrder,
): Promise<CreditSync> {
  if (order.subscription_id) return "ignored";
  const plan = planForCreditProduct(order.product_id);
  if (!plan) return "ignored";
  const projectId = order.metadata?.projectId;
  if (typeof projectId !== "string" || order.metadata?.kind !== CREDIT_ORDER_KIND) {
    // Produit de recharge acheté hors de l'application : rien ne désigne le projet.
    console.error("[billing] Recharge sans projet : à rapprocher par le support.", {
      orderId: order.id,
    });
    return "ignored";
  }
  if (!SETTLED.has(order.status)) return "pending";
  const net = cents(order.net_amount);
  if (net === null || order.currency?.toLowerCase() !== "usd") {
    console.error("[billing] Recharge illisible : à rapprocher par le support.", {
      orderId: order.id,
    });
    return "ignored";
  }
  const credit = net * CREDIT_UNITS_PER_CENT;
  const refundedCents =
    order.status === "refunded" ? net : Math.min(net, cents(order.refunded_amount) ?? 0);
  const refundTarget = refundedCents * CREDIT_UNITS_PER_CENT;
  return prisma.$transaction(async (tx) => {
    const [project] = await tx.$queryRaw<Array<{ id: string; internal: boolean }>>`
      SELECT id, internal FROM project WHERE id = ${projectId} FOR UPDATE`;
    if (!project || project.internal) {
      console.error("[billing] Recharge d'un projet introuvable : à rembourser.", {
        orderId: order.id,
      });
      return "ignored";
    }
    let purchase = await tx.messageCreditPurchase.findUnique({
      where: { orderId: order.id },
    });
    if (purchase && purchase.projectId !== project.id) return "ignored";
    if (!purchase) {
      purchase = await tx.messageCreditPurchase.create({
        data: {
          projectId: project.id,
          orderId: order.id,
          productId: order.product_id!,
          plan,
          credit,
        },
      });
      await tx.project.update({
        where: { id: project.id },
        data: { extraCredit: { increment: credit } },
      });
    }
    // Le déjà consommé n'est pas repris : le crédit ne descend jamais sous zéro.
    const delta = Math.min(purchase.credit, refundTarget) - purchase.refunded;
    if (delta > 0) {
      await tx.messageCreditPurchase.update({
        where: { id: purchase.id },
        data: { refunded: purchase.refunded + delta },
      });
      await tx.$executeRaw`UPDATE project
        SET "extraCredit" = GREATEST(0, "extraCredit" - ${delta}::int)
        WHERE id = ${project.id}`;
    }
    return "applied";
  });
}
