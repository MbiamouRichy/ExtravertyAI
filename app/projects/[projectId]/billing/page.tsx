import type { Metadata } from "next";
import type Stripe from "stripe";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowDownToLine,
  ArrowUpRight,
  CalendarDays,
  CircleAlert,
  CreditCard,
  FileText,
  Receipt,
  ShieldCheck,
} from "lucide-react";
import { getSession } from "@/lib/auth-server";
import prisma from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { LocalBillingDate } from "@/components/dashboard/project/local-billing-date";
import {
  billingStatusLabel,
  formatStripeAmount,
  stripeDocumentUrl,
} from "@/lib/billing-display";
import { BillingActions } from "@/components/dashboard/project/billing-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Facturation | ExtravertyAI",
  robots: { index: false, follow: false },
};
const idOf = (value: string | { id: string } | null) =>
  typeof value === "string" ? value : value?.id;
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
        },
      },
    },
  });
  if (!membership) notFound();
  if (!["OWNER", "ADMIN"].includes(membership.role))
    redirect(`/projects/${projectId}/chat?error=unauthorized`);
  const p = membership.project;
  const quota = await prisma.quotaPeriod.findFirst({
    where: { projectId, isCurrent: true },
  });
  const cursor =
    typeof query.after === "string" &&
    /^in_[A-Za-z0-9]{1,180}$/.test(query.after)
      ? query.after
      : undefined;
  let subscription: Stripe.Subscription | null = null;
  let customer: Stripe.Customer | null = null;
  let invoices: Stripe.Invoice[] = [];
  let hasMore = false;
  let unavailable = false;
  const configured = !!p.stripeCustomerId && !!p.stripeSubscriptionId;
  if (configured) {
    try {
      const options = { timeout: 10000, maxNetworkRetries: 0 };
      const [sub, account, history] = await Promise.all([
        stripe.subscriptions.retrieve(
          p.stripeSubscriptionId!,
          { expand: ["default_payment_method"] },
          options,
        ),
        stripe.customers.retrieve(
          p.stripeCustomerId!,
          { expand: ["invoice_settings.default_payment_method"] },
          options,
        ),
        stripe.invoices.list(
          {
            customer: p.stripeCustomerId!,
            subscription: p.stripeSubscriptionId!,
            limit: 10,
            ...(cursor ? { starting_after: cursor } : {}),
          },
          options,
        ),
      ]);
      if (idOf(sub.customer) !== p.stripeCustomerId || account.deleted)
        throw new Error("BILLING_SCOPE_INVALID");
      if (
        history.data.some(
          (invoice) =>
            idOf(invoice.customer) !== p.stripeCustomerId ||
            idOf(invoice.parent?.subscription_details?.subscription || null) !==
              p.stripeSubscriptionId,
        )
      )
        throw new Error("BILLING_SCOPE_INVALID");
      subscription = sub;
      customer = account;
      invoices = history.data;
      hasMore = history.has_more;
    } catch {
      unavailable = true;
    }
  }
  const item = subscription?.items.data[0];
  const paymentMethod =
    subscription?.default_payment_method ||
    customer?.invoice_settings.default_payment_method;
  const card =
    typeof paymentMethod === "object" && paymentMethod?.type === "card"
      ? paymentMethod.card
      : null;
  const end =
    subscription?.status === "trialing"
      ? subscription.trial_end
      : item?.current_period_end;
  const endsAt = end || p.stripeCurrentPeriodEnd;
  const cancelling =
    subscription?.cancel_at_period_end || !!subscription?.cancel_at;
  const status = subscription?.status || p.status;
  const nextCursor = invoices.at(-1)?.id;
  const renewal = !subscription
    ? "À vérifier"
    : ["canceled", "incomplete_expired"].includes(status)
      ? "Abonnement terminé"
      : cancelling
        ? "Résiliation programmée"
        : ["active", "trialing"].includes(status)
          ? "Renouvellement automatique"
          : "À régulariser";
  const price =
    item?.price.unit_amount != null && subscription?.items.data.length === 1
      ? formatStripeAmount(item.price.unit_amount * (item.quantity ?? 1), item.price.currency)
      : null;
  const interval = item?.price.recurring
    ? `${item.price.recurring.interval_count > 1 ? `${item.price.recurring.interval_count} ` : ""}${
        { day: "jour(s)", week: "semaine(s)", month: "mois", year: "an(s)" }[item.price.recurring.interval]
      }`
    : null;
  const usedRatio = quota ? Math.min(1, quota.used / Math.max(1, quota.limit)) : 0;

  return (
    <main className="mx-auto w-full min-w-0 max-w-6xl space-y-8 p-4 [overflow-wrap:anywhere] sm:p-6 xl:p-8">
      <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div className="min-w-0">
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Facturation · {p.name}
          </p>
          <h1 className="mt-1 text-3xl md:text-4xl">Abonnement et factures</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Votre offre, votre consommation et l’historique de vos paiements.
          </p>
        </div>
        <BillingActions
          projectId={projectId}
          canManage={membership.role === "OWNER"}
          configured={!!p.stripeCustomerId}
        />
      </header>

      {unavailable && (
        <div role="alert" className="flex gap-3 rounded-xl border border-dashed p-4 text-sm">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          La connexion à Stripe est temporairement indisponible. Les informations
          locales restent visibles ; montants et factures reviendront après
          actualisation.
        </div>
      )}
      {!configured && (
        <div role="status" className="flex gap-3 rounded-xl border border-dashed p-4 text-sm">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          Votre facturation n’est pas encore synchronisée. Si vous venez de créer
          ce projet, terminez le paiement puis actualisez cette page.
        </div>
      )}

      <section
        aria-label="Votre offre"
        className="grid overflow-hidden rounded-3xl border lg:grid-cols-[1.1fr_1fr]"
      >
        <div className="relative isolate bg-primary p-6 text-primary-foreground sm:p-8">
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-[radial-gradient(var(--primary-foreground)_1px,transparent_1px)] opacity-10 mask-[radial-gradient(ellipse_at_top_right,black,transparent_70%)] bg-size-[18px_18px]"
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider opacity-70">
              <Receipt aria-hidden="true" className="size-4" />
              Offre actuelle
            </p>
            <span className="rounded-full bg-primary-foreground/15 px-2.5 py-0.5 text-xs">
              {billingStatusLabel(status)}
            </span>
          </div>
          <p className="mt-6 font-heading text-4xl font-bold capitalize tracking-tight">{p.plan}</p>
          <p className="mt-2 text-2xl tabular-nums">
            {price ?? "Tarif à confirmer"}
            {price && interval && <span className="text-sm opacity-70"> / {interval}</span>}
          </p>
          <dl className="mt-8 grid gap-4 border-t border-primary-foreground/15 pt-5 sm:grid-cols-2">
            <div>
              <dt className="flex items-center gap-1.5 text-xs opacity-70">
                <CalendarDays aria-hidden="true" className="size-3.5" />
                {status === "trialing"
                  ? "Fin de l’essai"
                  : cancelling
                    ? "Fin prévue"
                    : "Fin de période"}
              </dt>
              <dd className="mt-1 text-sm font-medium">
                {subscription?.cancel_at || endsAt ? (
                  <LocalBillingDate value={subscription?.cancel_at || endsAt} />
                ) : (
                  "Non disponible"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs opacity-70">Renouvellement</dt>
              <dd className="mt-1 text-sm font-medium">{renewal}</dd>
            </div>
          </dl>
          <p className="mt-5 text-xs opacity-60">
            {subscription
              ? "Actualisé depuis Stripe. Taxes, remises et proratas figurent sur vos factures."
              : "Dernier état enregistré pour ce projet."}
          </p>
        </div>

        <div className="flex flex-col bg-card p-6 sm:p-8">
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Consommation
          </p>
          {quota ? (
            <>
              <p className="mt-6 flex flex-wrap items-baseline gap-2">
                <span className="font-heading text-4xl font-bold tabular-nums tracking-tight">
                  {quota.used.toLocaleString("fr-FR")}
                </span>
                <span className="text-sm text-muted-foreground">
                  / {quota.limit.toLocaleString("fr-FR")} messages
                </span>
              </p>
              <div
                role="progressbar"
                aria-label="Consommation du quota"
                aria-valuemin={0}
                aria-valuemax={Math.max(1, quota.limit)}
                aria-valuenow={Math.min(quota.used, Math.max(1, quota.limit))}
                className="mt-4 h-2.5 overflow-hidden rounded-full bg-muted"
              >
                <div
                  className={usedRatio >= 0.9 ? "h-full rounded-full bg-destructive" : "h-full rounded-full bg-foreground"}
                  style={{ width: `${usedRatio * 100}%` }}
                />
              </div>
              <p className="mt-3 text-sm">
                <span className="font-medium tabular-nums">
                  {Math.max(0, quota.limit - quota.used).toLocaleString("fr-FR")}
                </span>{" "}
                messages disponibles
              </p>
              <p className="mt-auto border-t pt-4 text-xs leading-relaxed text-muted-foreground">
                Du <LocalBillingDate value={quota.startsAt} dateOnly /> au{" "}
                <LocalBillingDate value={quota.endsAt} dateOnly />. L’IA et votre
                équipe partagent le même quota.
              </p>
              {quota.endsAt <= new Date() && (
                <p className="mt-2 text-sm text-destructive">
                  Cette période est expirée. Le prochain quota attend la
                  confirmation de facturation.
                </p>
              )}
            </>
          ) : (
            <p className="mt-6 text-sm text-muted-foreground">
              Aucune période de quota confirmée pour le moment.
            </p>
          )}
        </div>
      </section>

      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <section aria-labelledby="payment-title" className="rounded-2xl border bg-card p-5">
          <h2 id="payment-title" className="flex items-center gap-2 font-heading text-base font-semibold tracking-tight">
            <CreditCard aria-hidden="true" className="size-4" />
            Moyen de paiement
          </h2>
          {card ? (
            <div className="mt-4 flex items-center gap-4">
              <span className="flex h-10 w-14 items-center justify-center rounded-md border bg-muted font-mono text-[10px] font-bold uppercase">
                {card.brand}
              </span>
              <div>
                <p className="font-mono text-sm tabular-nums">•••• {card.last4}</p>
                <p className="text-xs text-muted-foreground">
                  Expire {String(card.exp_month).padStart(2, "0")}/{card.exp_year}
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              Les moyens de paiement sont gérés depuis le portail Stripe.
            </p>
          )}
        </section>
        <section aria-labelledby="details-title" className="rounded-2xl border bg-card p-5">
          <h2 id="details-title" className="flex items-center gap-2 font-heading text-base font-semibold tracking-tight">
            <ShieldCheck aria-hidden="true" className="size-4" />
            Coordonnées de facturation
          </h2>
          <p className="mt-4 break-words text-sm font-medium">{customer?.name || p.name}</p>
          <p className="mt-1 break-all text-sm text-muted-foreground">
            {customer?.email || "À renseigner dans le portail de facturation"}
          </p>
          {customer?.address && (
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {[
                customer.address.line1,
                customer.address.line2,
                customer.address.postal_code,
                customer.address.city,
                customer.address.country,
              ]
                .filter(Boolean)
                .join(", ")}
            </p>
          )}
        </section>
      </div>

      {membership.role !== "OWNER" ? (
        <p className="rounded-xl bg-muted/60 p-4 text-xs leading-relaxed text-muted-foreground">
          Seul le propriétaire du projet peut modifier l’offre, le moyen de
          paiement et les coordonnées de facturation.
        </p>
      ) : (
        <p className="text-xs leading-relaxed text-muted-foreground">
          Le renouvellement ouvre le paiement dû ou sa gestion sur Stripe. Un
          abonnement actif se renouvelle automatiquement ; les changements
          d’offre sont confirmés sur Stripe avant application.
        </p>
      )}

      <section aria-labelledby="invoices-title" className="overflow-hidden rounded-2xl border bg-card">
        <div className="border-b p-5">
          <h2 id="invoices-title" className="font-heading text-base font-semibold tracking-tight">
            Factures
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">De la plus récente à la plus ancienne.</p>
        </div>
        {invoices.length ? (
          <>
            <div
              role="region"
              aria-label="Historique des factures"
              tabIndex={0}
              className="overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <table className="w-full min-w-[36rem] text-left text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    {["Facture", "Date", "Montant", "Statut", ""].map((label, index) => (
                      <th key={index} scope="col" className="px-5 py-2.5 font-normal">
                        {label || <span className="sr-only">Documents</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {invoices.map((invoice) => {
                    const pdf = stripeDocumentUrl(invoice.invoice_pdf);
                    const hosted = stripeDocumentUrl(invoice.hosted_invoice_url);
                    return (
                      <tr key={invoice.id} className="transition-colors hover:bg-muted/30">
                        <td className="whitespace-nowrap px-5 py-3.5 font-mono text-xs font-medium">
                          {invoice.number || "En préparation"}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3.5 text-muted-foreground">
                          <LocalBillingDate value={invoice.created} dateOnly />
                        </td>
                        <td className="whitespace-nowrap px-5 py-3.5 tabular-nums">
                          {formatStripeAmount(invoice.total, invoice.currency)}
                        </td>
                        <td className="px-5 py-3.5">
                          <Badge variant={invoice.status === "paid" ? "secondary" : "outline"}>
                            {billingStatusLabel(invoice.status || "draft")}
                          </Badge>
                        </td>
                        <td className="px-5 py-2.5">
                          <div className="flex justify-end gap-1">
                            {pdf && (
                              <Button variant="ghost" size="sm" asChild>
                                <a
                                  href={pdf}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  aria-label={`Télécharger la facture ${invoice.number || ""} en PDF`}
                                >
                                  <ArrowDownToLine data-icon="inline-start" />
                                  PDF
                                </a>
                              </Button>
                            )}
                            {hosted && (
                              <Button variant="ghost" size="sm" asChild>
                                <a href={hosted} target="_blank" rel="noopener noreferrer">
                                  Consulter
                                  <ArrowUpRight data-icon="inline-end" />
                                </a>
                              </Button>
                            )}
                            {!pdf && !hosted && (
                              <span className="text-xs text-muted-foreground">En préparation</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t p-4 sm:px-5">
              <p className="text-xs text-muted-foreground">
                {invoices.length} facture{invoices.length > 1 ? "s" : ""} affichée{invoices.length > 1 ? "s" : ""}
              </p>
              <div className="flex flex-wrap gap-2">
                {cursor && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/projects/${projectId}/billing`}>Les plus récentes</Link>
                  </Button>
                )}
                {hasMore && nextCursor && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/projects/${projectId}/billing?after=${encodeURIComponent(nextCursor)}`}>
                      Factures précédentes
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center px-6 py-14 text-center">
            <span className="flex size-12 items-center justify-center rounded-2xl border bg-muted/50">
              <FileText aria-hidden="true" className="size-5 text-muted-foreground" />
            </span>
            <p className="mt-4 font-medium">
              {unavailable
                ? "Factures momentanément indisponibles"
                : cursor
                  ? "Fin de l’historique"
                  : "Vos factures apparaîtront ici"}
            </p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {unavailable
                ? "Actualisez la page pour rétablir la connexion."
                : "Chaque facture émise pour cet abonnement sera accessible depuis cet espace."}
            </p>
            {cursor && (
              <Button className="mt-4" variant="outline" size="sm" asChild>
                <Link href={`/projects/${projectId}/billing`}>Revenir aux dernières factures</Link>
              </Button>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
