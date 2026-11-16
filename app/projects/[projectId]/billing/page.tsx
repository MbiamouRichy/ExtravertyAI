import type { Metadata } from "next";
import { needsInitialCheckout } from "@/lib/billing-display";
import { can, homePath } from "@/lib/project-permissions";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  Building2,
  CalendarClock,
  CircleAlert,
  CreditCard,
  FileText,
  MessageSquarePlus,
  Repeat,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getSession } from "@/lib/auth-server";
import prisma from "@/lib/prisma";
import {
  getPolarCustomer,
  getPolarDefaultCard,
  getPolarSubscription,
  isEndedPolarSubscription,
  listPolarOrders,
  type PolarCard,
  type PolarOrder,
  type PolarSubscription,
} from "@/lib/polar";
import { planForPolarProduct } from "@/lib/billing-polar";
import { isPaymentHolder, maskEmail } from "@/lib/billing-plan-change";
import {
  EXTRA_PACK_MESSAGES,
  PRICING_PLANS,
  formatPlanPrice,
  pricingPlan,
  resolvePlanId,
} from "@/lib/pricing";
import { returnAnchor } from "@/lib/return-anchor";
import { LocalBillingDate } from "@/components/dashboard/project/local-billing-date";
import { billingStatusLabel, formatBillingAmount } from "@/lib/billing-display";
import {
  BillingActions,
  BillingCancelSection,
  PAYMENT_ANCHOR,
  PaymentSettingsButton,
} from "@/components/dashboard/project/billing-actions";
import { BillingInvoiceButton } from "@/components/dashboard/project/billing-invoice-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageCreditButton } from "@/components/dashboard/project/message-credit-button";
import {
  MAX_CREDIT_PACKS,
  creditCents,
  creditPackUnits,
  extraMessageCost,
  polarCreditProductId,
} from "@/lib/message-credit";

/**
 * Projet interne d'ExtravertyAI : ni abonnement ni facture. Seul le quota
 * mensuel, qui borne le coût d'une boucle ou d'un abus, est affiché.
 */
function InternalBilling({
  name,
  quota,
}: {
  name: string;
  quota: { used: number; limit: number; endsAt: Date } | null;
}) {
  const ratio = quota ? Math.min(1, quota.used / Math.max(1, quota.limit)) : 0;
  return (
    <main className="mx-auto w-full min-w-0 max-w-5xl space-y-8 p-4 wrap-break-word sm:p-6 xl:p-8">
      <header className="min-w-0">
        <p className="truncate text-sm text-muted-foreground">{name}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
          Facturation
        </h1>
      </header>
      <section aria-labelledby="internal-title" className="overflow-hidden rounded-xl border bg-card">
        <div className="flex gap-3 p-4 sm:p-6">
          <Building2 aria-hidden="true" className="mt-1 size-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <h2 id="internal-title" className="flex flex-wrap items-center gap-2 text-xl font-semibold tracking-tight">
              Projet interne
              <Badge variant="secondary">Sans facturation</Badge>
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Ce projet appartient à ExtravertyAI. Il n’a ni abonnement ni facture et dispose
              des fonctions de l’offre Business. Son quota de messages se renouvelle le 1er de
              chaque mois.
            </p>
          </div>
        </div>
        <div className="border-t px-4 py-3.5 sm:p-6">
          <p className="text-xs text-muted-foreground">Messages ce mois-ci</p>
          {quota ? (
            <>
              <p className="mt-1 text-sm font-medium tabular-nums">
                {quota.used.toLocaleString("fr-FR")}
                <span className="font-normal text-muted-foreground">
                  {" "}/ {quota.limit.toLocaleString("fr-FR")}
                </span>
              </p>
              <div
                role="progressbar"
                aria-label="Messages utilisés ce mois-ci"
                aria-valuemin={0}
                aria-valuemax={Math.max(1, quota.limit)}
                aria-valuenow={Math.min(quota.used, Math.max(1, quota.limit))}
                className="mt-2 h-1.5 max-w-sm overflow-hidden rounded-full bg-muted"
              >
                <div
                  className={ratio >= 0.9 ? "h-full rounded-full bg-destructive" : "h-full rounded-full bg-primary"}
                  style={{ width: `${ratio * 100}%` }}
                />
              </div>
            </>
          ) : (
            <p role="status" className="mt-1 text-sm text-muted-foreground">
              Quota en préparation : le worker de facturation l’ouvre dans la minute.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}

const CARD_BRANDS: Record<string, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "American Express",
  discover: "Discover",
  diners: "Diners Club",
  jcb: "JCB",
  unionpay: "UnionPay",
  cartes_bancaires: "Cartes Bancaires",
};

function planOfProduct(productId: string | null | undefined) {
  if (!productId) return null;
  try {
    return planForPolarProduct(productId);
  } catch {
    return null;
  }
}

/** Carte enregistrée : marque, 4 derniers chiffres et expiration, rien de plus. */
function CardSummary({ card }: { card: PolarCard }) {
  const now = new Date();
  const expired =
    card.expYear < now.getUTCFullYear() ||
    (card.expYear === now.getUTCFullYear() && card.expMonth < now.getUTCMonth() + 1);
  return (
    <p>
      <span className="font-medium">
        {CARD_BRANDS[card.brand.toLowerCase()] ?? "Carte"}{" "}
        <span className="tabular-nums">
          <span aria-hidden="true">•••• </span>
          <span className="sr-only">se terminant par </span>
          {card.last4}
        </span>
      </span>
      <span className={cn("ml-2 text-xs tabular-nums", expired ? "text-destructive" : "text-muted-foreground")}>
        {expired ? "Expirée " : "Exp. "}
        {String(card.expMonth).padStart(2, "0")}/{card.expYear}
      </span>
    </p>
  );
}

/** Une ligne de la liste unique des factures : abonnement ou recharge. */
type InvoiceRow = {
  id: string;
  orderId: string;
  kind: "subscription" | "credit";
  label: string;
  date: Date;
  amount: string;
  /** null : payée, rien à signaler. */
  status: string | null;
};

const CARD = "min-w-0 rounded-xl border bg-card";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Facturation | ExtravertyAI",
  robots: { index: false, follow: false },
};
export default async function BillingPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ projectId }, query] = await Promise.all([params, searchParams]);
  const session = await getSession();
  if (!session?.user?.id)
    redirect(
      `/sign-in?callbackUrl=${encodeURIComponent(`/projects/${projectId}/billing`)}`,
    );
  const membership = await prisma.projectMembership.findUnique({
    where: { userId_projectId: { userId: session.user.id, projectId } },
    select: {
      role: true,
      project: {
        select: {
          name: true,
          plan: true,
          status: true,
          stripeCustomerId: true,
          stripeSubscriptionId: true,
          stripeCurrentPeriodEnd: true,
          internal: true,
          extraCredit: true,
          automationPaused: true,
          statusBeforePause: true,
        },
      },
    },
  });
  if (!membership) notFound();
  if (!can(membership.role, "billing.view"))
    redirect(homePath(projectId, membership.role));
  const p = membership.project;
  const canManage = can(membership.role, "billing.manage");
  const [quota, members] = await Promise.all([
    prisma.quotaPeriod.findFirst({ where: { projectId, isCurrent: true } }),
    canManage && !p.internal
      ? prisma.projectMembership.count({ where: { projectId } })
      : 0,
  ]);
  if (p.internal) return <InternalBilling name={p.name} quota={quota} />;
  const ordersPage =
    typeof query.page === "string" && /^[1-9]\d{0,3}$/.test(query.page)
      ? Number(query.page)
      : 1;
  const firstPage = ordersPage === 1;
  let subscription: PolarSubscription | null = null;
  let orders: PolarOrder[] = [];
  let hasMore = false;
  let unavailable = false;
  // Bornes de la page de factures, pour y glisser les recharges de la même période.
  let newerThan: Date | null = null;
  let olderThan: Date | null = null;
  // Carte et titulaire : réservés aux rôles qui gèrent la facturation.
  // card : null sans carte enregistrée, undefined si Polar ne l'a pas donnée.
  let payment: {
    holder: string;
    card: PolarCard | "several" | null | undefined;
  } | null = null;
  const configured = !!p.stripeCustomerId && !!p.stripeSubscriptionId;
  if (configured) {
    const customerId = p.stripeCustomerId!;
    const paymentLookup = canManage
      ? getPolarCustomer(customerId)
          .then(async (customer) =>
            customer.id === customerId
              ? {
                  holder: customer.email,
                  card: await getPolarDefaultCard(customer).catch(() => undefined),
                }
              : null,
          )
          .catch(() => null)
      : Promise.resolve(null);
    try {
      const [sub, history, previous, paymentInfo] = await Promise.all([
        getPolarSubscription(p.stripeSubscriptionId!),
        listPolarOrders(p.stripeSubscriptionId!, ordersPage),
        firstPage ? null : listPolarOrders(p.stripeSubscriptionId!, ordersPage - 1),
        paymentLookup,
      ]);
      payment = paymentInfo;
      if (
        sub.customer_id !== p.stripeCustomerId ||
        history.orders.some((order) => order.subscription_id !== sub.id)
      )
        throw new Error("BILLING_SCOPE_INVALID");
      subscription = sub;
      // L'essai crée une commande à 0 : ce n'est pas un paiement à afficher.
      orders = history.orders.filter((order) => order.total_amount > 0);
      hasMore = ordersPage < history.maxPage;
      const oldest = (list: PolarOrder[]) =>
        list.length ? new Date(list[list.length - 1].created_at) : null;
      newerThan = hasMore ? oldest(history.orders) : null;
      olderThan = previous ? oldest(previous.orders) : null;
    } catch {
      unavailable = true;
    }
  }
  // Recharges de la même période que cette page de factures (toutes sur la
  // dernière page) ; sans Polar, seulement les plus récentes en première page.
  const purchases =
    !firstPage && (unavailable || !configured)
      ? []
      : await prisma.messageCreditPurchase.findMany({
          where: {
            projectId,
            createdAt: {
              ...(newerThan ? { gte: newerThan } : {}),
              ...(olderThan ? { lt: olderThan } : {}),
            },
          },
          orderBy: { createdAt: "desc" },
          take: 50,
          select: { id: true, orderId: true, credit: true, refunded: true, createdAt: true },
        });
  const periodEnd =
    subscription?.status === "trialing"
      ? subscription.trial_end
      : subscription?.current_period_end;
  const endsAt = periodEnd ? new Date(periodEnd) : p.stripeCurrentPeriodEnd;
  const cancelling = !!subscription?.cancel_at_period_end;
  const status = subscription?.status || p.status;
  const synced = !!subscription;
  const ended = !!subscription && isEndedPolarSubscription(subscription);
  const upToDate = ["active", "trialing"].includes(status);
  const cancellation =
    synced && !ended && !cancelling
      ? { atPeriodEnd: upToDate, trial: status === "trialing", endsAt }
      : null;
  // Une seule action principale : celle qu'appelle l'état de l'abonnement.
  const primary = !canManage || !synced
    ? null
    : ended
      ? { intent: "renew" as const, label: "Renouveler l’offre" }
      : cancelling
        ? { intent: "renew" as const, label: "Réactiver l’abonnement" }
        : upToDate
          ? { intent: "upgrade" as const, label: "Changer d’offre" }
          : { intent: "renew" as const, label: "Régulariser le paiement" };
  const currentPlan = planOfProduct(subscription?.product_id) ?? resolvePlanId(p.plan);
  const scheduled = planOfProduct(subscription?.pending_update?.product_id);
  const pendingPlan = scheduled && scheduled !== currentPlan ? scheduled : null;
  const pendingAt = pendingPlan ? (subscription?.pending_update?.applies_at ?? null) : null;
  // « ?offre=changer » ou « ?offre=business » : lien d'une autre page vers ce formulaire.
  const offer = typeof query.offre === "string" ? query.offre : null;
  const requestedPlan = PRICING_PLANS.find((plan) => plan.id === offer)?.id;
  const changePlan =
    primary?.intent === "upgrade" && subscription
      ? {
          state: {
            projectId,
            projectName: p.name,
            currentPlan,
            status: status === "trialing" ? ("trialing" as const) : ("active" as const),
            pendingPlan,
            pendingAt,
            periodEnd: periodEnd ?? null,
            members,
          },
          defaultOpen: offer === "changer" || !!requestedPlan,
          defaultPlan: requestedPlan,
        }
      : null;
  const holder = payment?.holder ?? subscription?.customer?.email ?? null;
  const isHolder =
    !!session.user.emailVerified && isPaymentHolder(session.user.email, holder);
  // Sans carte précise à montrer : pourquoi, en quelques mots.
  const cardNote = !configured
    ? "Enregistrée au premier paiement"
    : !payment
      ? "Indisponible pour le moment"
      : payment.card === null
        ? "Aucune carte enregistrée"
        : payment.card === "several"
          ? "Plusieurs cartes enregistrées"
          : "Carte enregistrée chez Polar";
  const price = subscription
    ? formatBillingAmount(subscription.amount, subscription.currency)
    : null;
  const intervalLabels: Record<string, string> = {
    day: "jour",
    week: "semaine",
    month: "mois",
    year: "an",
  };
  const interval = subscription
    ? intervalLabels[subscription.recurring_interval]
    : null;
  const billedTo = [subscription?.customer?.name, subscription?.customer?.email]
    .filter(Boolean)
    .join(" · ");
  const usedRatio = quota ? Math.min(1, quota.used / Math.max(1, quota.limit)) : 0;
  const endPhrase =
    ended
      ? "terminé le"
      : cancelling
        ? "jusqu’au"
        : status === "trialing"
          ? "essai jusqu’au"
          : upToDate
            ? "renouvelé le"
            : "échéance le";

  // Abonnement et recharges : une seule liste, la plus récente en haut.
  const creditPlan = pricingPlan(p.plan);
  const invoices: InvoiceRow[] = [
    ...orders.map((order) => ({
      id: order.id,
      orderId: order.id,
      kind: "subscription" as const,
      label: `Abonnement ${pricingPlan(planOfProduct(order.product_id) ?? currentPlan).name}`,
      date: new Date(order.created_at),
      amount: formatBillingAmount(order.total_amount, order.currency),
      status: order.status === "paid" ? null : billingStatusLabel(order.status),
    })),
    ...purchases.map((purchase) => ({
      id: purchase.id,
      orderId: purchase.orderId,
      kind: "credit" as const,
      label: `Recharge de messages`,
      date: purchase.createdAt,
      amount: formatBillingAmount(creditCents(purchase.credit), "usd"),
      status:
        purchase.refunded >= purchase.credit
          ? "Remboursée"
          : purchase.refunded > 0
            ? "Remboursée en partie"
            : null,
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  // Messages au-delà du quota : crédit prépayé, décompté au tarif de l'offre.
  const perMessage = extraMessageCost(p.plan);
  const creditMessages = Math.floor(p.extraCredit / perMessage);
  const paidPeriod =
    p.status === "active" ||
    (p.automationPaused && p.status === "paused" && p.statusBeforePause === "active");
  const creditOffered = !!polarCreditProductId(creditPlan.id);
  const creditFull =
    p.extraCredit + creditPackUnits(creditPlan.id) > MAX_CREDIT_PACKS * creditPackUnits(creditPlan.id);
  const packLabel = `Acheter ${EXTRA_PACK_MESSAGES.toLocaleString("fr-FR")} messages · ${formatPlanPrice(creditPlan.extraPackCents)}`;
  const showCredit = creditOffered || p.extraCredit > 0;
  const nextHref = `/projects/${projectId}/billing?page=${ordersPage + 1}`;
  const firstHref = `/projects/${projectId}/billing`;

  return (
    // wrap-break-word plutôt que « anywhere » : les longues valeurs passent à
    // la ligne sans que les boutons et libellés se cassent au milieu d'un mot.
    <main className="mx-auto w-full min-w-0 max-w-5xl space-y-8 p-4 wrap-break-word sm:p-6 xl:p-8">
      <header className="min-w-0">
        <p className="truncate text-sm text-muted-foreground">{p.name}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Facturation</h1>
      </header>

      {(unavailable || !configured) && (
        <p
          role={unavailable ? "alert" : "status"}
          className="flex gap-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground"
        >
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-foreground" />
          {unavailable
            ? "Le service de paiement ne répond pas. Actualisez dans un instant."
            : "Facturation pas encore synchronisée. Terminez le paiement puis actualisez."}
        </p>
      )}

      {/* Offre et crédit côte à côte dès que la zone de contenu (et non
          l'écran, barre latérale ouverte ou non) est assez large. Même
          structure dans les deux cartes : libellé, valeur, précision, puis
          action en pied, à la même hauteur d'une carte à l'autre. */}
      <div className="@container">
        <div className={cn("grid gap-4", showCredit && "@4xl:grid-cols-5")}>
          <section
            aria-labelledby="plan-title"
            className={cn(CARD, "flex flex-col", showCredit && "@4xl:col-span-3")}
          >
            <div className="p-4 sm:p-6">
              <div className="flex h-6 items-center justify-between gap-3">
                <h2 id="plan-title" className="text-sm text-muted-foreground">
                  Offre
                </h2>
                <Badge variant={cancelling || ended || !upToDate ? "outline" : "secondary"}>
                  {cancelling && !ended ? "Résiliation programmée" : billingStatusLabel(status)}
                </Badge>
              </div>
              <p className="mt-2 text-2xl font-semibold tracking-tight">
                {pricingPlan(currentPlan).name}
              </p>
              <p className="mt-1 text-sm text-muted-foreground tabular-nums">
                {price ? (
                  <>
                    <span className="font-medium text-foreground">{price}</span>
                    {interval && ` / ${interval}`}
                  </>
                ) : (
                  "Tarif à confirmer"
                )}
                {endsAt && (
                  <>
                    <span aria-hidden="true"> · </span>
                    {endPhrase} <LocalBillingDate value={endsAt} dateOnly />
                  </>
                )}
              </p>
              {pendingPlan && (
                <p role="status" className="mt-3 flex items-start gap-2 text-sm">
                  <CalendarClock
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                  />
                  <span>
                    Passe à l’offre {pricingPlan(pendingPlan).name}{" "}
                    {pendingAt ? (
                      <>
                        le <LocalBillingDate value={pendingAt} dateOnly />
                      </>
                    ) : (
                      "au renouvellement"
                    )}
                    .
                  </span>
                </p>
              )}
            </div>
            <div className="mt-auto flex min-h-18 flex-col justify-center gap-4 border-t px-4 py-4 sm:flex-row sm:items-center sm:gap-6 sm:px-6">
              <div className="min-w-0 flex-1">
                {quota ? (
                  <>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="text-muted-foreground">Messages utilisés</span>
                      <span className="font-medium tabular-nums">
                        {quota.used.toLocaleString("fr-FR")}
                        <span className="font-normal text-muted-foreground">
                          {" "}/ {quota.limit.toLocaleString("fr-FR")}
                        </span>
                      </span>
                    </div>
                    <div
                      role="progressbar"
                      aria-label="Messages utilisés sur la période"
                      aria-valuemin={0}
                      aria-valuemax={Math.max(1, quota.limit)}
                      aria-valuenow={Math.min(quota.used, Math.max(1, quota.limit))}
                      className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
                    >
                      <div
                        className={cn(
                          "h-full rounded-full",
                          usedRatio >= 0.9 ? "bg-destructive" : "bg-primary",
                        )}
                        style={{ width: `${usedRatio * 100}%` }}
                      />
                    </div>
                    {(quota.extraUsed > 0 || quota.endsAt <= new Date()) && (
                      <p className="mt-2 text-xs text-muted-foreground tabular-nums">
                        {quota.endsAt <= new Date() ? (
                          <span className="text-destructive">
                            Période terminée : en attente du paiement.
                          </span>
                        ) : (
                          `+ ${quota.extraUsed.toLocaleString("fr-FR")} payés par le crédit`
                        )}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Aucune période en cours</p>
                )}
              </div>
              {canManage && (
                <div className="shrink-0 empty:hidden">
                  <BillingActions
                    projectId={projectId}
                    configured={!!p.stripeCustomerId}
                    needsCheckout={needsInitialCheckout(p)}
                    primary={primary}
                    changePlan={changePlan}
                  />
                </div>
              )}
            </div>
          </section>

          {showCredit && (
            <section
              aria-labelledby="credit-title"
              className={cn(CARD, "flex flex-col @4xl:col-span-2")}
            >
              <div className="p-4 sm:p-6">
                <div className="flex h-6 items-center">
                  <h2 id="credit-title" className="text-sm text-muted-foreground">
                    Crédit messages
                  </h2>
                </div>
                <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">
                  {formatBillingAmount(creditCents(p.extraCredit), "usd")}
                </p>
                <p className="mt-1 text-sm text-muted-foreground tabular-nums">
                  ≈ {creditMessages.toLocaleString("fr-FR")} messages après le quota
                </p>
                {query.recharge === "ok" && (
                  <p role="status" className="mt-3 text-sm">
                    Paiement reçu : le crédit s’ajoute dans un instant.
                  </p>
                )}
              </div>
              {canManage && creditOffered && (
                <div className="mt-auto flex min-h-18 flex-col justify-center gap-1.5 border-t px-4 py-4 sm:items-end sm:px-6 @4xl:items-stretch">
                  <MessageCreditButton
                    projectId={projectId}
                    label={packLabel}
                    disabled={!paidPeriod || creditFull}
                    className="w-full sm:w-auto @4xl:w-full"
                  />
                  {(!paidPeriod || creditFull) && (
                    <p className="text-center text-xs text-muted-foreground">
                      {creditFull
                        ? "Crédit maximal atteint."
                        : p.status === "trialing"
                          ? "Disponible après l’essai."
                          : "Disponible avec un abonnement à jour."}
                    </p>
                  )}
                </div>
              )}
            </section>
          )}
        </div>
      </div>

      <section aria-labelledby="invoices-title" className="space-y-3">
        <h2 id="invoices-title" className="text-base font-semibold tracking-tight">
          Factures
        </h2>
        {invoices.length ? (
          <div className={cn(CARD, "overflow-hidden")}>
            <ul aria-labelledby="invoices-title" className="divide-y">
              {invoices.map((row) => {
                const Icon = row.kind === "credit" ? MessageSquarePlus : Repeat;
                return (
                  <li key={row.id} className="flex items-center gap-3 px-4 py-3 sm:gap-4 sm:px-6">
                    {/* Écran étroit : le libellé prend la place de l'icône,
                        qu'il nomme déjà, pour rester lisible en entier. */}
                    <span
                      aria-hidden="true"
                      className="hidden size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground sm:flex"
                    >
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium break-words">{row.label}</p>
                      <p className="text-xs text-muted-foreground">
                        <LocalBillingDate value={row.date} dateOnly shortMonth />
                        {row.status && (
                          <>
                            <span aria-hidden="true"> · </span>
                            <span className="text-foreground">{row.status}</span>
                          </>
                        )}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-medium tabular-nums">{row.amount}</p>
                    <div className="-mr-2 shrink-0">
                      <BillingInvoiceButton
                        projectId={projectId}
                        orderId={row.orderId}
                        label={`Télécharger la facture « ${row.label} » en PDF`}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
            {(!firstPage || hasMore) && (
              <div className="flex flex-wrap justify-end gap-2 border-t p-2 sm:p-3">
                {!firstPage && (
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={firstHref}>Plus récentes</Link>
                  </Button>
                )}
                {hasMore && (
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={nextHref}>Plus anciennes</Link>
                  </Button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed p-4 text-sm text-muted-foreground sm:px-6">
            <FileText aria-hidden="true" className="size-4 shrink-0" />
            <p className="min-w-0 flex-1">
              {unavailable
                ? "Factures indisponibles pour le moment."
                : firstPage
                  ? "Aucune facture pour l’instant."
                  : "Fin de l’historique."}
            </p>
            {!firstPage && (
              <Button variant="ghost" size="sm" asChild>
                <Link href={firstHref}>Plus récentes</Link>
              </Button>
            )}
          </div>
        )}
      </section>

      {canManage ? (
        <section aria-labelledby="payment-title" className="space-y-3">
          <h2 id="payment-title" className="text-base font-semibold tracking-tight">
            Paiement
          </h2>
          <div
            {...returnAnchor(
              PAYMENT_ANCHOR,
              cn(CARD, "flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"),
            )}
          >
            <div className="flex min-w-0 items-center gap-3 text-sm">
              <span
                aria-hidden="true"
                className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
              >
                <CreditCard className="size-4" />
              </span>
              <div className="min-w-0">
                {payment?.card && payment.card !== "several" ? (
                  <CardSummary card={payment.card} />
                ) : (
                  <p className="text-muted-foreground">{cardNote}</p>
                )}
                {billedTo && <p className="truncate text-xs text-muted-foreground">{billedTo}</p>}
                {synced && holder && !isHolder && (
                  <p className="text-xs text-muted-foreground">
                    Modifiable par le titulaire ({maskEmail(holder)}).
                  </p>
                )}
              </div>
            </div>
            {synced && holder && isHolder && <PaymentSettingsButton projectId={projectId} />}
          </div>
        </section>
      ) : (
        <p className="text-xs text-muted-foreground">
          Seuls le propriétaire et le rôle Facturation modifient l’offre et le paiement.
        </p>
      )}

      {canManage && cancellation && (
        <BillingCancelSection
          projectId={projectId}
          sessionCreatedAt={new Date(session.session.createdAt).toISOString()}
          cancellation={cancellation}
        />
      )}
    </main>
  );
}
