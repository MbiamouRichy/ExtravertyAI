import type { Metadata } from "next";
import { CalendarClock, History, Mail, MessageCircle, Search, Tag } from "lucide-react";

import prisma from "@/lib/prisma";
import { adminMetadata, requireAdminPage } from "@/lib/admin-auth";
import { getUserTimeZone } from "@/lib/server-time-zone";
import {
  PROJECT_SEARCH_MAX,
  listManualPayments,
  listRenewals,
  manualBillingStats,
  searchBillingProjects,
  type BillingProject,
} from "@/lib/manual-billing";
import { MANUAL_PAYMENT_METHOD_LABEL, formatXaf } from "@/lib/manual-billing-shared";
import { pricingPlan } from "@/lib/pricing";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { BillingProjectSearch } from "@/components/admin/billing-project-search";
import {
  ManualPaymentDialog,
  type ManualPaymentTarget,
} from "@/components/admin/manual-payment-dialog";
import { cn } from "@/lib/utils";

export function generateMetadata(): Promise<Metadata> {
  return adminMetadata("Paiements hors carte");
}

const CARD = "min-w-0 rounded-2xl border bg-card";
// Badge passe à la ligne : un statut long (« Abonnement suspendu ou terminé »)
// débordait de la carte sous 360 px.
const BADGE_WRAP = "h-auto max-w-full py-0.5 text-left leading-snug whitespace-normal";
const CONTACT_LINK =
  "inline-flex min-h-6 max-w-full items-center gap-1 rounded-sm underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none";

/** Lien wa.me : chiffres seuls, rien d'autre ne passe dans l'URL. */
function whatsappHref(numero: string) {
  const digits = numero.replace(/\D/g, "");
  return digits.length >= 8 ? `https://wa.me/${digits}` : null;
}

function formatter(timeZone: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone,
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function target(project: BillingProject): ManualPaymentTarget {
  return {
    id: project.id,
    name: project.name,
    ownerEmail: project.ownerEmail,
    plan: project.plan,
    runningEndsAt: project.period?.running ? project.period.endsAt.toISOString() : null,
    cardSubscription: project.cardSubscription,
    deletionPending: project.deletionPending,
  };
}

function periodLine(project: BillingProject, now: Date, format: Intl.DateTimeFormat) {
  const period = project.period;
  if (!period) return `Créé le ${format.format(project.createdAt)} · aucun paiement`;
  const ended = period.endsAt <= now;
  const source = period.manual ? "Mobile money" : "Carte (Polar)";
  return `${source} · ${ended ? "terminé le" : "jusqu’au"} ${format.format(period.endsAt)} · ${period.used.toLocaleString("fr-FR")} / ${period.limit.toLocaleString("fr-FR")} messages`;
}

function ProjectRow({
  project,
  now,
  timeZone,
  renewal = false,
}: {
  project: BillingProject;
  now: Date;
  timeZone: string;
  renewal?: boolean;
}) {
  const format = formatter(timeZone);
  const ended = !!project.period && project.period.endsAt <= now;
  const whatsapp = whatsappHref(project.numero);
  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="min-w-0 font-medium wrap-break-word">{project.name}</p>
          <Badge variant={project.accessAllowed ? "secondary" : "outline"} className={BADGE_WRAP}>
            {project.accessLabel}
          </Badge>
          {project.cardSubscription && (
            <Badge variant="outline" className={BADGE_WRAP}>
              Abonnement carte
            </Badge>
          )}
        </div>
        {/* Une coordonnée par bloc : elles passent à la ligne entières, et
            l'e-mail seul se coupe s'il dépasse la carte. */}
        <div className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
          {project.ownerEmail ? (
            <a href={`mailto:${project.ownerEmail}`} className={CONTACT_LINK}>
              <Mail aria-hidden="true" className="size-3.5 shrink-0" />
              <span className="min-w-0 [overflow-wrap:anywhere]">{project.ownerEmail}</span>
            </a>
          ) : (
            <span className="inline-flex min-h-6 items-center">Sans propriétaire</span>
          )}
          {whatsapp ? (
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(CONTACT_LINK, "whitespace-nowrap tabular-nums")}
            >
              <MessageCircle aria-hidden="true" className="size-3.5 shrink-0" />
              {project.numero}
              <span className="sr-only"> (écrire sur WhatsApp, nouvel onglet)</span>
            </a>
          ) : (
            <span className="inline-flex min-h-6 items-center tabular-nums">{project.numero}</span>
          )}
          <span className="inline-flex min-h-6 items-center gap-1 whitespace-nowrap">
            <Tag aria-hidden="true" className="size-3.5 shrink-0" />
            Offre {pricingPlan(project.plan).name}
          </span>
        </div>
        <p
          className={cn(
            "text-xs tabular-nums wrap-break-word",
            renewal && ended ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {periodLine(project, now, format)}
        </p>
      </div>
      <div className="shrink-0">
        <ManualPaymentDialog project={target(project)} timeZone={timeZone} renewal={renewal} />
      </div>
    </li>
  );
}

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Revérifié ici : le layout ne protège pas les navigations côté client.
  await requireAdminPage();
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim().slice(0, PROJECT_SEARCH_MAX) : "";
  const now = new Date();
  const [projects, renewals, payments, stats, timeZone] = await Promise.all([
    searchBillingProjects(prisma, query, now),
    listRenewals(prisma, now),
    listManualPayments(prisma),
    manualBillingStats(prisma, now),
    getUserTimeZone(),
  ]);
  const month = new Intl.DateTimeFormat("fr-FR", { month: "long", timeZone: "UTC" }).format(
    stats.monthStart,
  );
  const format = formatter(timeZone);

  const tiles = [
    {
      label: `Encaissé en ${month}`,
      value: formatXaf(stats.collected),
      note: `${stats.paymentCount.toLocaleString("fr-FR")} paiement${stats.paymentCount > 1 ? "s" : ""} hors carte`,
    },
    {
      label: "Accès payés en cours",
      value: stats.running.toLocaleString("fr-FR"),
      note: "Projets réglés par mobile money",
    },
    {
      label: "À renouveler",
      value: renewals.length.toLocaleString("fr-FR"),
      note: "Fin sous 7 jours ou terminés depuis moins de 30 jours",
    },
  ];

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <header>
        <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Back-office · Facturation
        </p>
        <h1 className="mt-1 text-3xl md:text-4xl">Paiements hors carte</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Airtel Money, Moov Money, espèces ou virement : retrouvez le projet du client,
          enregistrez le paiement avec l’identifiant de la transaction, et l’accès s’ouvre
          aussitôt. Chaque paiement est journalisé.
        </p>
      </header>

      <section aria-label="Chiffres du mois" className="grid gap-3 sm:grid-cols-3">
        {tiles.map((tile) => (
          <div key={tile.label} className={cn(CARD, "p-4")}>
            <p className="text-xs text-muted-foreground">{tile.label}</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{tile.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{tile.note}</p>
          </div>
        ))}
      </section>

      {renewals.length > 0 && (
        <section aria-labelledby="renewals-title" className="space-y-3">
          <h2 id="renewals-title" className="flex items-center gap-2 text-base font-semibold tracking-tight">
            <CalendarClock aria-hidden="true" className="size-4 text-muted-foreground" />
            À relancer
          </h2>
          <ul aria-labelledby="renewals-title" className={cn(CARD, "divide-y overflow-hidden")}>
            {renewals.map((project) => (
              <ProjectRow key={project.id} project={project} now={now} timeZone={timeZone} renewal />
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="projects-title" className="space-y-3">
        <div className="flex flex-col gap-1">
          <h2 id="projects-title" className="text-base font-semibold tracking-tight">
            Projets
          </h2>
          <p className="text-xs text-muted-foreground">
            {query ? `Résultats pour « ${query} » (20 au plus)` : "Les 20 derniers projets créés"}
          </p>
        </div>
        <BillingProjectSearch query={query} />
        {projects.length ? (
          <ul aria-labelledby="projects-title" className={cn(CARD, "divide-y overflow-hidden")}>
            {projects.map((project) => (
              <ProjectRow key={project.id} project={project} now={now} timeZone={timeZone} />
            ))}
          </ul>
        ) : (
          <Empty className="rounded-2xl border border-dashed p-8">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Search aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>Aucun projet trouvé</EmptyTitle>
              <EmptyDescription>
                Cherchez par nom de projet, e-mail du propriétaire ou au moins 4 chiffres du
                numéro WhatsApp.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </section>

      <section aria-labelledby="history-title" className="space-y-3">
        <h2 id="history-title" className="flex items-center gap-2 text-base font-semibold tracking-tight">
          <History aria-hidden="true" className="size-4 text-muted-foreground" />
          Derniers paiements
        </h2>
        {payments.length ? (
          <ul aria-labelledby="history-title" className={cn(CARD, "divide-y overflow-hidden")}>
            {payments.map((payment) => (
              <li key={payment.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:gap-3 sm:px-5">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="font-medium wrap-break-word">
                    {payment.projectName ?? "Projet supprimé"}
                  </p>
                  <p className="text-xs text-muted-foreground wrap-break-word">
                    {MANUAL_PAYMENT_METHOD_LABEL[payment.method]}
                    {payment.reference && (
                      <>
                        <span aria-hidden="true"> · </span>
                        réf. <span className="font-mono">{payment.reference}</span>
                      </>
                    )}
                    <span aria-hidden="true"> · </span>
                    {pricingPlan(payment.plan).name}, {payment.months} mois
                    {payment.mode === "extend" && " (prolongation)"}
                  </p>
                  <p className="text-xs text-muted-foreground wrap-break-word">
                    Accès jusqu’au {format.format(new Date(payment.endsAt))}
                    <span aria-hidden="true"> · </span>
                    par {payment.actorEmail}
                  </p>
                  {payment.note && (
                    <p className="text-xs wrap-break-word text-foreground/80">{payment.note}</p>
                  )}
                </div>
                {/* Sous sm, le montant passe sous le détail au lieu d'écraser sa colonne. */}
                <div className="flex shrink-0 items-baseline gap-2 sm:block sm:text-right">
                  <p className="text-sm font-medium tabular-nums">{formatXaf(payment.amountXaf)}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    <time dateTime={payment.createdAt.toISOString()}>
                      {format.format(payment.createdAt)}
                    </time>
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
            Aucun paiement hors carte enregistré pour l’instant.
          </p>
        )}
      </section>
    </div>
  );
}
