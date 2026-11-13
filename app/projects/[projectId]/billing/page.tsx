import type { Metadata } from "next";
import { needsInitialCheckout } from "@/lib/billing-display";
import { can, homePath } from "@/lib/project-permissions";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Building2, CircleAlert, FileText } from "lucide-react";
import { getSession } from "@/lib/auth-server";
import prisma from "@/lib/prisma";
import {
  getPolarSubscription,
  isEndedPolarSubscription,
  listPolarOrders,
  type PolarOrder,
  type PolarSubscription,
} from "@/lib/polar";
import { LocalBillingDate } from "@/components/dashboard/project/local-billing-date";
import { billingStatusLabel, formatBillingAmount } from "@/lib/billing-display";
import {
  BillingActions,
  BillingCancelSection,
} from "@/components/dashboard/project/billing-actions";
import { BillingInvoiceButton } from "@/components/dashboard/project/billing-invoice-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
    <main className="mx-auto w-full min-w-0 max-w-4xl space-y-8 p-4 wrap-break-word sm:space-y-10 sm:p-6 xl:p-8">
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
        },
      },
    },
  });
  if (!membership) notFound();
  if (!can(membership.role, "billing.view"))
    redirect(homePath(projectId, membership.role));
  const p = membership.project;
  const quota = await prisma.quotaPeriod.findFirst({
    where: { projectId, isCurrent: true },
  });
  if (p.internal) return <InternalBilling name={p.name} quota={quota} />;
  const ordersPage =
    typeof query.page === "string" && /^[1-9]\d{0,3}$/.test(query.page)
      ? Number(query.page)
      : 1;
  let subscription: PolarSubscription | null = null;
  let orders: PolarOrder[] = [];
  let hasMore = false;
  let unavailable = false;
  const configured = !!p.stripeCustomerId && !!p.stripeSubscriptionId;
  if (configured) {
    try {
      const [sub, history] = await Promise.all([
        getPolarSubscription(p.stripeSubscriptionId!),
        listPolarOrders(p.stripeSubscriptionId!, ordersPage),
      ]);
      if (
        sub.customer_id !== p.stripeCustomerId ||
        history.orders.some((order) => order.subscription_id !== sub.id)
      )
        throw new Error("BILLING_SCOPE_INVALID");
      subscription = sub;
      // L'essai crée une commande à 0 : ce n'est pas un paiement à afficher.
      orders = history.orders.filter((order) => order.total_amount > 0);
      hasMore = ordersPage < history.maxPage;
    } catch {
      unavailable = true;
    }
  }
  const periodEnd =
    subscription?.status === "trialing"
      ? subscription.trial_end
      : subscription?.current_period_end;
  const endsAt = periodEnd ? new Date(periodEnd) : p.stripeCurrentPeriodEnd;
  const cancelling = !!subscription?.cancel_at_period_end;
  const status = subscription?.status || p.status;
  const synced = !!subscription;
  const ended = !!subscription && isEndedPolarSubscription(subscription);
  const cancellation =
    synced && !ended && !cancelling
      ? {
          atPeriodEnd: ["active", "trialing"].includes(status),
          trial: status === "trialing",
          endsAt,
        }
      : null;
  const canManage = can(membership.role, "billing.manage");
  const renewal = !synced
    ? "À vérifier"
    : ended
      ? "Abonnement terminé"
      : cancelling
        ? "Résiliation programmée"
        : ["active", "trialing"].includes(status)
          ? "Automatique"
          : "Paiement à régulariser";
  // Une seule action principale : celle qu'appelle l'état de l'abonnement.
  const primary = !canManage || !synced
    ? null
    : ended
      ? { intent: "renew" as const, label: "Renouveler le plan" }
      : cancelling
        ? { intent: "renew" as const, label: "Réactiver l’abonnement" }
        : ["active", "trialing"].includes(status)
          ? { intent: "upgrade" as const, label: "Changer d’offre" }
          : { intent: "renew" as const, label: "Régulariser le paiement" };
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
  const billingName = subscription?.customer?.name;
  const billingEmail = subscription?.customer?.email;
  const billingAddress = subscription?.customer?.billing_address;
  const usedRatio = quota ? Math.min(1, quota.used / Math.max(1, quota.limit)) : 0;
  const endLabel =
    status === "trialing" && !cancelling
      ? "Fin de l’essai"
      : cancelling || ended
        ? "Fin de l’abonnement"
        : "Prochain renouvellement";
  const rows = orders.map((order) => ({
    id: order.id,
    number: order.invoice_number,
    date: new Date(order.created_at),
    amount: formatBillingAmount(order.total_amount, order.currency),
    status: order.status,
    document: (
      <BillingInvoiceButton
        projectId={projectId}
        orderId={order.id}
        label={`Télécharger la facture ${order.invoice_number || ""} en PDF`}
      />
    ),
  }));
  const firstPage = ordersPage === 1;
  const nextHref = `/projects/${projectId}/billing?page=${ordersPage + 1}`;

  return (
    // wrap-break-word plutôt que « anywhere » : les longues valeurs passent à
    // la ligne sans que les boutons et libellés se cassent au milieu d'un mot.
    <main className="mx-auto w-full min-w-0 max-w-4xl space-y-8 p-4 wrap-break-word sm:space-y-10 sm:p-6 xl:p-8">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="min-w-0">
          <p className="truncate text-sm text-muted-foreground">{p.name}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            Facturation
          </h1>
        </div>
        {canManage && (
          <BillingActions
            projectId={projectId}
            configured={!!p.stripeCustomerId}
            needsCheckout={needsInitialCheckout(p)}
            primary={primary}
          />
        )}
      </header>

      {(unavailable || !configured) && (
        <p
          role={unavailable ? "alert" : "status"}
          className="flex gap-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground"
        >
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-foreground" />
          {unavailable
            ? "Le service de paiement ne répond pas. Les informations enregistrées restent affichées ; actualisez dans un instant."
            : "Votre facturation n’est pas encore synchronisée. Si vous venez de créer ce projet, terminez le paiement puis actualisez cette page."}
        </p>
      )}

      <section aria-labelledby="plan-title" className="overflow-hidden rounded-xl border bg-card">
        <div className="p-4 sm:p-6">
          <h2 id="plan-title" className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <span className="text-xl font-semibold capitalize tracking-tight">{p.plan}</span>
            <Badge variant={cancelling || ended ? "outline" : "secondary"}>
              {cancelling && !ended ? "Résiliation programmée" : billingStatusLabel(status)}
            </Badge>
          </h2>
          <p className="mt-1 text-sm text-muted-foreground tabular-nums">
            {price ? (
              <>
                <span className="text-foreground">{price}</span>
                {interval && ` / ${interval}`}
              </>
            ) : (
              "Tarif à confirmer"
            )}
          </p>
        </div>
        <dl className="grid grid-cols-1 border-t max-sm:divide-y sm:grid-cols-3 sm:divide-x">
          <div className="px-4 py-3.5 sm:p-6">
            <dt className="text-xs text-muted-foreground">{endLabel}</dt>
            <dd className="mt-1 text-sm font-medium">
              <LocalBillingDate value={endsAt} dateOnly />
            </dd>
          </div>
          <div className="px-4 py-3.5 sm:p-6">
            <dt className="text-xs text-muted-foreground">Renouvellement</dt>
            <dd className="mt-1 text-sm font-medium">{renewal}</dd>
          </div>
          <div className="px-4 py-3.5 sm:p-6">
            <dt className="text-xs text-muted-foreground">Messages</dt>
            {quota ? (
              <dd className="mt-1">
                <p className="text-sm font-medium tabular-nums">
                  {quota.used.toLocaleString("fr-FR")}
                  <span className="font-normal text-muted-foreground">
                    {" "}/ {quota.limit.toLocaleString("fr-FR")}
                  </span>
                </p>
                <div
                  role="progressbar"
                  aria-label="Messages utilisés sur la période"
                  aria-valuemin={0}
                  aria-valuemax={Math.max(1, quota.limit)}
                  aria-valuenow={Math.min(quota.used, Math.max(1, quota.limit))}
                  className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
                >
                  <div
                    className={usedRatio >= 0.9 ? "h-full rounded-full bg-destructive" : "h-full rounded-full bg-primary"}
                    style={{ width: `${usedRatio * 100}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {quota.endsAt <= new Date() ? (
                    <span className="text-destructive">
                      Période expirée : le prochain quota attend la confirmation du paiement.
                    </span>
                  ) : (
                    <>
                      Jusqu’au <LocalBillingDate value={quota.endsAt} dateOnly />, IA et
                      équipe comprises.
                    </>
                  )}
                </p>
              </dd>
            ) : (
              <dd className="mt-1 text-sm text-muted-foreground">Aucune période en cours</dd>
            )}
          </div>
        </dl>
      </section>

      <section aria-labelledby="details-title" className="space-y-3">
        <h2 id="details-title" className="text-sm font-medium">
          Paiement
        </h2>
        <dl className="divide-y rounded-xl border bg-card text-sm">
          <div className="flex flex-col gap-1 px-4 py-3.5 sm:flex-row sm:gap-6 sm:p-5">
            <dt className="text-muted-foreground sm:w-40 sm:shrink-0">Moyen de paiement</dt>
            <dd className="min-w-0">
              <span className="text-muted-foreground">
                Consultable et modifiable dans « Gérer le paiement ».
              </span>
            </dd>
          </div>
          <div className="flex flex-col gap-1 px-4 py-3.5 sm:flex-row sm:gap-6 sm:p-5">
            <dt className="text-muted-foreground sm:w-40 sm:shrink-0">Facturé à</dt>
            <dd className="min-w-0">
              <p className="font-medium">{billingName || p.name}</p>
              <p className="break-all text-muted-foreground">
                {billingEmail || "Adresse à renseigner dans « Gérer le paiement »"}
              </p>
              {billingAddress && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {[
                    billingAddress.line1,
                    billingAddress.line2,
                    billingAddress.postal_code,
                    billingAddress.city,
                    billingAddress.country,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              )}
            </dd>
          </div>
        </dl>
        {!canManage && (
          <p className="text-xs text-muted-foreground">
            Seuls le propriétaire et le rôle Facturation peuvent modifier l’offre et le paiement.
          </p>
        )}
      </section>

      <section aria-labelledby="invoices-title" className="space-y-3">
        <h2 id="invoices-title" className="text-sm font-medium">
          Factures
        </h2>
        {rows.length ? (
          <div className="overflow-hidden rounded-xl border bg-card">
            {/* Mobile : une ligne par facture, sans défilement horizontal.
                Date et montant en tête, statut et numéro dessous, document à droite. */}
            <ul aria-labelledby="invoices-title" className="divide-y sm:hidden">
              {rows.map((row) => (
                <li
                  key={row.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 px-4 py-3"
                >
                  <p className="text-sm">
                    <LocalBillingDate value={row.date} dateOnly shortMonth />
                  </p>
                  <p className="text-right text-sm font-medium tabular-nums">{row.amount}</p>
                  <p className="min-w-0 text-xs text-muted-foreground">
                    {billingStatusLabel(row.status)}
                    <span aria-hidden="true"> · </span>
                    <span className="break-all font-mono">
                      {row.number || "Numéro en préparation"}
                    </span>
                  </p>
                  <div className="-mr-2.5 justify-self-end">{row.document}</div>
                </li>
              ))}
            </ul>
            {/* Dès sm : tableau. « relative » garde dans la zone défilante le
                libellé masqué de la colonne Document (positionné en absolu),
                qui sinon élargissait toute la page. */}
            <div
              role="region"
              aria-label="Historique des factures"
              tabIndex={0}
              className="relative overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-sm:hidden"
            >
              <table className="w-full min-w-[32rem] text-left text-sm">
                <thead className="border-b text-xs text-muted-foreground">
                  <tr>
                    {["Date", "Numéro", "Montant", "Statut", ""].map((label, index) => (
                      <th key={index} scope="col" className="px-5 py-3 font-normal">
                        {label || <span className="sr-only">Document</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td className="whitespace-nowrap px-5 py-3">
                        <LocalBillingDate value={row.date} dateOnly />
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-muted-foreground">
                        {row.number || "En préparation"}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 tabular-nums">{row.amount}</td>
                      <td className="whitespace-nowrap px-5 py-3 text-muted-foreground">
                        {billingStatusLabel(row.status)}
                      </td>
                      <td className="px-5 py-2 text-right">{row.document}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {(!firstPage || hasMore) && (
              <div className="flex flex-wrap justify-end gap-2 border-t p-2 sm:p-3">
                {!firstPage && (
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/projects/${projectId}/billing`}>Plus récentes</Link>
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
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed p-4 text-sm text-muted-foreground sm:p-5">
            <FileText aria-hidden="true" className="size-4 shrink-0" />
            <p className="min-w-0 flex-1">
              {unavailable
                ? "Factures momentanément indisponibles. Actualisez la page dans un instant."
                : !firstPage
                  ? "Fin de l’historique."
                  : "Aucune facture pour l’instant. Elles apparaîtront ici après chaque paiement."}
            </p>
            {!firstPage && (
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/projects/${projectId}/billing`}>Plus récentes</Link>
              </Button>
            )}
          </div>
        )}
      </section>

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
