import type { Metadata } from "next";
import type Stripe from "stripe";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowDownToLine,
  ArrowUpRight,
  CalendarDays,
  CreditCard,
  FileText,
  Receipt,
  ShieldCheck,
} from "lucide-react";
import { getSession } from "@/lib/auth-server";
import prisma from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import {
  billingStatusLabel,
  formatStripeAmount,
  stripeDocumentUrl,
} from "@/lib/billing-display";
import { BillingActions } from "@/components/dashboard/project/billing-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Facturation | ExtravertyAI",
  robots: { index: false, follow: false },
};
const date = (value: number | Date | null | undefined) =>
  value
    ? new Date(
        typeof value === "number" ? value * 1000 : value,
      ).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      })
    : "Non disponible";
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
  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-7 sm:px-8 lg:py-10">
      <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Administration · {p.name}
          </p>
          <h1 className="text-3xl! font-semibold tracking-tight">
            Votre facturation, en clair.
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Suivez votre abonnement, votre consommation et vos factures.
          </p>
        </div>
        <BillingActions
          projectId={projectId}
          canManage={membership.role === "OWNER"}
          configured={!!p.stripeCustomerId}
        />
      </header>
      {unavailable && (
        <div role="alert" className="rounded-xl border bg-muted/50 p-4 text-sm">
          La connexion à Stripe est temporairement indisponible. Les
          informations locales restent visibles ; les montants et factures
          seront disponibles après actualisation.
        </div>
      )}
      {!configured && (
        <div
          role="status"
          className="rounded-xl border bg-muted/50 p-4 text-sm"
        >
          Votre facturation n’est pas encore synchronisée. Si vous venez de
          créer ce projet, terminez le paiement puis actualisez cette page.
        </div>
      )}
      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <Card className="overflow-hidden">
          <CardHeader className="border-b bg-muted/30">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-3 text-xl">
                <span className="rounded-xl border bg-background p-2.5">
                  <Receipt className="size-5" />
                </span>
                Offre <span className="capitalize">{p.plan}</span>
              </CardTitle>
              <Badge variant="secondary">{billingStatusLabel(status)}</Badge>
            </div>
            <CardDescription>
              {subscription
                ? "Informations actualisées depuis votre abonnement."
                : "Dernier état enregistré pour ce projet."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Tarif récurrent de l’abonnement
              </p>
              <p className="mt-2 text-3xl font-semibold tracking-tight">
                {item?.price.unit_amount != null &&
                subscription?.items.data.length === 1
                  ? formatStripeAmount(
                      item.price.unit_amount * (item.quantity ?? 1),
                      item.price.currency,
                    )
                  : "À confirmer"}
                {item?.price.recurring && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    /{" "}
                    {item.price.recurring.interval_count > 1
                      ? `${item.price.recurring.interval_count} `
                      : ""}
                    {
                      {
                        day: "jour(s)",
                        week: "semaine(s)",
                        month: "mois",
                        year: "an(s)",
                      }[item.price.recurring.interval]
                    }
                  </span>
                )}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Les taxes, remises, proratas et crédits éventuels sont détaillés
                sur vos factures.
              </p>
            </div>
            <div className="grid gap-4 border-t pt-5 sm:grid-cols-2">
              <div>
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CalendarDays className="size-3.5" />
                  {status === "trialing"
                    ? "Fin de l’essai"
                    : cancelling
                      ? "Fin prévue de l’abonnement"
                      : "Fin de période"}
                </p>
                <p className="mt-2 text-sm font-medium">
                  {date(subscription?.cancel_at || endsAt)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Renouvellement</p>
                <p className="mt-2 text-sm font-medium">
                  {!subscription
                    ? "À vérifier"
                    : ["canceled", "incomplete_expired"].includes(status)
                      ? "Abonnement terminé"
                      : cancelling
                        ? "Résiliation programmée"
                        : ["active", "trialing"].includes(status)
                          ? "Automatique"
                          : "À régulariser"}
                </p>
              </div>
            </div>
            {membership.role !== "OWNER" && (
              <p className="rounded-lg bg-muted p-3 text-xs leading-relaxed text-muted-foreground">
                Le propriétaire du projet peut modifier l’offre, le moyen de
                paiement et les coordonnées de facturation.
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Votre consommation</CardTitle>
            <CardDescription>
              Messages sortants réservés sur la période courante.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {quota ? (
              <>
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-semibold tracking-tight">
                    {quota.used.toLocaleString("fr-FR")}
                  </span>
                  <span className="pb-1 text-sm text-muted-foreground">
                    / {quota.limit.toLocaleString("fr-FR")} messages
                  </span>
                </div>
                <progress
                  aria-label="Consommation du quota"
                  value={Math.min(quota.used, Math.max(1, quota.limit))}
                  max={Math.max(1, quota.limit)}
                  className="h-2 w-full overflow-hidden rounded-full accent-primary"
                />
                <p className="text-sm">
                  {Math.max(0, quota.limit - quota.used).toLocaleString(
                    "fr-FR",
                  )}{" "}
                  messages disponibles
                </p>
                <p className="border-t pt-4 text-xs leading-relaxed text-muted-foreground">
                  Du {date(quota.startsAt)} au {date(quota.endsAt)}. Les
                  réponses de l’IA et de votre équipe utilisent le même quota.
                </p>
                {quota.endsAt <= new Date() && (
                  <p className="text-sm text-destructive">
                    Cette période est expirée. Le prochain quota attend la
                    confirmation de facturation.
                  </p>
                )}
              </>
            ) : (
              <p className="py-6 text-sm text-muted-foreground">
                Aucune période de quota confirmée pour le moment.
              </p>
            )}
            <Button variant="outline" asChild>
              <Link href={`/projects/${projectId}/settings`}>
                Voir les paramètres <ArrowUpRight className="size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="size-4" /> Moyen de paiement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium">
              {card
                ? `${card.brand.toUpperCase()} ···· ${card.last4}`
                : "Consulter le portail de facturation"}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {card
                ? `Expiration ${String(card.exp_month).padStart(2, "0")}/${card.exp_year}`
                : "Les moyens de paiement sont gérés par Stripe."}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="size-4" /> Coordonnées de facturation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="break-words text-sm font-medium">
              {customer?.name || p.name}
            </p>
            <p className="mt-2 break-all text-sm text-muted-foreground">
              {customer?.email || "À renseigner dans le portail de facturation"}
            </p>
            {customer?.address && (
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
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
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Historique des factures</CardTitle>
          <CardDescription>
            Les factures de cet abonnement, de la plus récente à la plus
            ancienne.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invoices.length ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-y bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                      {["Facture", "Date", "Total", "Statut", "Documents"].map(
                        (label) => (
                          <th key={label} className="px-4 py-3 font-medium">
                            {label}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {invoices.map((invoice) => {
                      const pdf = stripeDocumentUrl(invoice.invoice_pdf);
                      const hosted = stripeDocumentUrl(
                        invoice.hosted_invoice_url,
                      );
                      return (
                        <tr key={invoice.id}>
                          <td className="whitespace-nowrap px-4 py-4 font-medium">
                            {invoice.number || "En préparation"}
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 text-muted-foreground">
                            {date(invoice.created)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-4">
                            {formatStripeAmount(
                              invoice.total,
                              invoice.currency,
                            )}
                          </td>
                          <td className="px-4 py-4">
                            <Badge variant="outline">
                              {billingStatusLabel(invoice.status || "draft")}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              {pdf && (
                                <Button variant="ghost" size="sm" asChild>
                                  <a
                                    href={pdf}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label={`Télécharger la facture ${invoice.number || ""} en PDF`}
                                  >
                                    <ArrowDownToLine className="size-4" /> PDF
                                  </a>
                                </Button>
                              )}
                              {hosted && (
                                <Button variant="ghost" size="sm" asChild>
                                  <a
                                    href={hosted}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    Consulter{" "}
                                    <ArrowUpRight className="size-3.5" />
                                  </a>
                                </Button>
                              )}
                              {!pdf && !hosted && (
                                <span className="text-xs text-muted-foreground">
                                  En préparation
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  {invoices.length} facture(s) affichée(s)
                </p>
                <div className="flex gap-2">
                  {cursor && (
                    <Button variant="outline" asChild>
                      <Link href={`/projects/${projectId}/billing`}>
                        Les plus récentes
                      </Link>
                    </Button>
                  )}
                  {hasMore && nextCursor && (
                    <Button variant="outline" asChild>
                      <Link
                        href={`/projects/${projectId}/billing?after=${encodeURIComponent(nextCursor)}`}
                      >
                        Factures précédentes
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center py-12 text-center">
              <FileText className="mb-4 size-8 text-muted-foreground" />
              <p className="font-medium">
                {unavailable
                  ? "Factures momentanément indisponibles"
                  : cursor
                    ? "Fin de l’historique"
                    : "Vos factures apparaîtront ici"}
              </p>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                {unavailable
                  ? "Actualisez la page pour rétablir la connexion."
                  : "Chaque facture émise pour cet abonnement sera accessible depuis cet espace."}
              </p>
              {cursor && (
                <Button className="mt-4" variant="outline" asChild>
                  <Link href={`/projects/${projectId}/billing`}>
                    Revenir aux dernières factures
                  </Link>
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
