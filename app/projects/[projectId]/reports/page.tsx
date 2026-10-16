import { getUserTimeZone } from "@/lib/server-time-zone";
import { LocalDate } from "@/components/local-date";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  Check,
  ChevronRight,
  Lightbulb,
  Mail,
  Minus,
  ShieldCheck,
} from "lucide-react";
import { getSession } from "@/lib/auth-server";
import prisma from "@/lib/prisma";
import { getBillingAccess } from "@/lib/billing-access";
import {
  ReportSnapshotSchema,
  reportMetricLabels,
  reportDelta,
  reportRange,
  reportWindow,
  WEEK_MS,
  type ReportMetrics,
} from "@/lib/weekly-report";
import { cn } from "@/lib/utils";
import { getInitials } from "@/components/getInitials";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ReportSettingsForm } from "@/components/dashboard/project/report-settings";
import { BillingPlanButton } from "@/components/dashboard/project/billing-plan-button";

export const metadata: Metadata = {
  title: "Rapports programmés | ExtravertyAI",
  robots: { index: false, follow: false },
};
const explanations: Record<keyof ReportMetrics, string> = {
  received: "Messages entrants de vos clients durant la semaine.",
  sent: "Messages sortants confirmés envoyés, distribués ou lus. Les envois en attente et en échec sont exclus.",
  aiSent:
    "Messages envoyés par le bot parmi les messages sortants confirmés. Ce chiffre ne mesure pas la qualité des réponses.",
  failed:
    "Messages sortants créés sur la période et en échec au moment du calcul. Une baisse est généralement souhaitable.",
  activeContacts:
    "Contacts distincts ayant au moins un message sur la période, quel que soit son statut.",
  newContacts:
    "Contacts créés sur la période. Il ne s’agit pas de ventes ni de conversions.",
  changes:
    "Enregistrements de configuration de l’agent durant la semaine. Ils ne prouvent pas une amélioration de performance.",
};
const states = {
  PENDING: "En attente",
  SENDING: "En cours",
  SENT: "Accepté par le service e-mail",
  CANCELLED: "Annulé",
  REVIEW_REQUIRED: "À vérifier par le support",
};
const roleLabel: Record<string, string> = {
  OWNER: "Propriétaire",
  ADMIN: "Administrateur",
};

/** Numéro de semaine ISO 8601 (la semaine du jeudi donne l’année). */
function isoWeek(date: Date) {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  day.setUTCDate(day.getUTCDate() + 3 - ((day.getUTCDay() + 6) % 7));
  const firstThursday = new Date(Date.UTC(day.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((day.getTime() - firstThursday.getTime()) / 86_400_000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
}

function Trend({ current, previous }: { current: number; previous: number }) {
  const label = reportDelta(current, previous);
  const Icon =
    previous === 0 || current === previous
      ? Minus
      : current > previous
        ? ArrowUpRight
        : ArrowDownRight;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs tabular-nums">
      <Icon aria-hidden="true" className="size-3" />
      {label}
    </span>
  );
}

export default async function ReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ report?: string | string[] }>;
}) {
  const timeZone = await getUserTimeZone();
  const { projectId } = await params;
  const session = await getSession();
  const base = `/projects/${encodeURIComponent(projectId)}`;
  if (!session?.user?.id)
    redirect(
      `/sign-in?${new URLSearchParams({ callbackUrl: `${base}/reports` })}`,
    );
  const member = await prisma.projectMembership.findUnique({
    where: { userId_projectId: { userId: session.user.id, projectId } },
    include: { project: true },
  });
  if (!member || member.project.deletionPending) notFound();
  if (!["OWNER", "ADMIN"].includes(member.role))
    redirect(`${base}?error=unauthorized`);
  const project = member.project;
  const access = await getBillingAccess(prisma, projectId);
  const eligible = project.plan === "business" && access.allowed;

  if (project.plan !== "business")
    return (
      <main className="mx-auto grid w-full max-w-6xl items-center gap-12 p-4 sm:p-8 lg:grid-cols-2 lg:p-12">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-xs uppercase tracking-wider text-muted-foreground">
            <CalendarClock aria-hidden="true" className="size-3.5" />
            Offre Business
          </p>
          <h1 className="mt-5 text-4xl md:text-5xl">Votre semaine, en un rapport.</h1>
          <p className="mt-4 max-w-md text-muted-foreground">
            Chaque semaine, vos indicateurs, leur évolution et des pistes
            d’amélioration arrivent dans la boîte mail des propriétaires et
            administrateurs.
          </p>
          <ul className="mt-6 space-y-2 text-sm">
            {[
              "7 indicateurs comparés à la semaine précédente",
              "Pistes d’amélioration concrètes",
              "Données agrégées : aucun message client dans l’e-mail",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <Check aria-hidden="true" className="size-4 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            {member.role === "OWNER" ? (
              <BillingPlanButton
                projectId={projectId}
                intent="upgrade"
                size="lg"
                label="Passer à l’offre Business"
              />
            ) : (
              <Button asChild size="lg">
                <Link href={`${base}/billing`}>Voir l’offre Business</Link>
              </Button>
            )}
            {member.role !== "OWNER" && (
              <p className="text-xs text-muted-foreground">
                Seul le propriétaire du projet peut changer d’offre.
              </p>
            )}
          </div>
        </div>
        <figure
          aria-label="Aperçu d’exemple d’un rapport hebdomadaire"
          className="relative rounded-3xl border bg-card p-6 shadow-xl shadow-foreground/5"
        >
          <figcaption className="mb-5 flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-mono uppercase tracking-wider">Aperçu d’exemple</span>
            <span>Lundi · 08:00</span>
          </figcaption>
          <p className="font-heading text-lg font-semibold">Bilan de la semaine</p>
          <div aria-hidden="true" className="mt-4 grid grid-cols-2 gap-3">
            {[
              ["Messages reçus", "1 284", "+12 %"],
              ["Réponses IA", "962", "+8 %"],
              ["Contacts actifs", "214", "+5 %"],
              ["Échecs d’envoi", "3", "−40 %"],
            ].map(([label, value, delta]) => (
              <div key={label} className="rounded-xl border p-3">
                <p className="text-[11px] text-muted-foreground">{label}</p>
                <p className="mt-1 font-heading text-xl font-bold tabular-nums">{value}</p>
                <p className="text-[11px] text-muted-foreground">{delta}</p>
              </div>
            ))}
          </div>
          <div aria-hidden="true" className="mt-4 rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
            <Lightbulb className="mb-1 size-3.5 text-foreground" />
            Relisez les conversations transmises par l’IA pour enrichir ses consignes.
          </div>
        </figure>
      </main>
    );

  const requested = (await searchParams).report;
  const [reports, recipients] = await Promise.all([
    prisma.weeklyReport.findMany({
      where: { projectId },
      orderBy: { weekStart: "desc" },
      take: 12,
      include: { emails: { select: { id: true, state: true, sentAt: true } } },
    }),
    prisma.projectMembership.findMany({
      where: { projectId, role: { in: ["OWNER", "ADMIN"] } },
      select: {
        id: true,
        role: true,
        user: { select: { name: true, email: true, emailVerified: true } },
      },
    }),
  ]);
  const selected =
    typeof requested === "string"
      ? await prisma.weeklyReport.findFirst({
          where: { id: requested, projectId },
          include: {
            emails: { select: { id: true, state: true, sentAt: true } },
          },
        })
      : reports[0];
  if (typeof requested === "string" && !selected) notFound();
  const snapshot = selected
    ? ReportSnapshotSchema.parse(selected.snapshot)
    : null;
  const now = new Date();
  const window = reportWindow(now, project.reportsHourUtc);
  const nextScheduled =
    project.createdAt >= window.end && now < window.due
      ? new Date(window.due.getTime() + WEEK_MS)
      : window.next;
  const thisWeekGenerated = reports.some(
    (report) => report.weekStart.getTime() === window.start.getTime(),
  );
  const catchingUp =
    !thisWeekGenerated && now >= window.due && project.createdAt < window.end;
  const verifiedRecipients = recipients.filter((r) => r.user.emailVerified).length;
  const metricKeys = Object.keys(reportMetricLabels) as (keyof ReportMetrics)[];

  const status = [
    {
      icon: CalendarClock,
      title: !eligible
        ? "Abonnement à régulariser"
        : !project.reportsEnabled
          ? "Envois suspendus"
          : catchingUp
            ? "Rapport à préparer"
            : "Prochain envoi",
      text: !eligible ? (
        access.message
      ) : !project.reportsEnabled ? (
        "Réactivez les rapports dans la programmation."
      ) : catchingUp ? (
        "La dernière semaine complète sera traitée au prochain passage du service."
      ) : (
        <LocalDate value={nextScheduled} />
      ),
    },
    {
      icon: Mail,
      title: `${verifiedRecipients} destinataire${verifiedRecipients > 1 ? "s" : ""} éligible${verifiedRecipients > 1 ? "s" : ""}`,
      text: "Propriétaires et administrateurs aux adresses vérifiées, envois individuels.",
    },
    {
      icon: ShieldCheck,
      title: "Données agrégées uniquement",
      text: "Aucun message client, numéro ou pièce jointe dans les e-mails.",
    },
  ];

  return (
    <main className="mx-auto w-full max-w-7xl space-y-8 p-4 sm:p-6 xl:p-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Business · {project.name}
          </p>
          <h1 className="mt-2 text-3xl md:text-4xl">Rapports programmés</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Chaque semaine, les chiffres utiles et les prochaines actions
            arrivent dans votre boîte mail.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={`${base}/analytics`}>
            Explorer les statistiques <ArrowUpRight data-icon="inline-end" />
          </Link>
        </Button>
      </header>

      <section
        aria-label="État des envois"
        className="grid divide-y rounded-2xl border bg-card sm:grid-cols-3 sm:divide-x sm:divide-y-0"
      >
        {status.map(({ icon: Icon, title, text }) => (
          <div key={title} className="flex gap-3 p-5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-background">
              <Icon aria-hidden="true" className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium">{title}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{text}</p>
            </div>
          </div>
        ))}
      </section>

      <div className="grid items-start gap-8 lg:grid-cols-3">
        <div className="space-y-10 lg:col-span-2">
          <section aria-labelledby="report-preview">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 id="report-preview" className="text-2xl tracking-tight">
                  {selected ? "Bilan de la semaine" : "Votre premier rapport arrive bientôt"}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selected
                    ? `${reportRange(selected.weekStart, selected.weekEnd, timeZone)} · comparé aux 7 jours précédents`
                    : "Les rapports couvrent une semaine complète. Les données apparaîtront ici dès le premier calcul."}
                </p>
              </div>
            </div>

            {snapshot ? (
              <>
                <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {metricKeys.map((key, index) => (
                    <li
                      key={key}
                      className={cn(
                        "rounded-2xl border bg-card p-5",
                        index === 0 && "bg-primary text-primary-foreground sm:col-span-2 xl:col-span-1",
                      )}
                    >
                      <h3
                        className={cn(
                          "font-sans text-sm font-normal tracking-normal",
                          index === 0 ? "opacity-75" : "text-muted-foreground",
                        )}
                      >
                        {reportMetricLabels[key]}
                      </h3>
                      <p className="mt-2 font-heading text-4xl font-bold tracking-tight tabular-nums">
                        {snapshot.current[key].toLocaleString("fr-FR")}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                        <Trend current={snapshot.current[key]} previous={snapshot.previous[key]} />
                        <span className={index === 0 ? "opacity-75" : "text-muted-foreground"}>
                          avant : {snapshot.previous[key].toLocaleString("fr-FR")}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
                {snapshot.partial && (
                  <p className="mt-4 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                    Projet récent : une partie des périodes comparées précède sa
                    création. Interprétez les variations avec prudence.
                  </p>
                )}
                {snapshot.tips.length > 0 && (
                  <div className="mt-6 rounded-2xl border bg-muted/40 p-6">
                    <h3 className="flex items-center gap-2 text-lg">
                      <Lightbulb aria-hidden="true" className="size-4" />
                      Pistes d’amélioration
                    </h3>
                    <ol className="mt-4 space-y-3">
                      {snapshot.tips.map((tip, index) => (
                        <li key={tip} className="flex gap-3 text-sm">
                          <span className="flex size-6 shrink-0 items-center justify-center rounded-full border bg-background font-mono text-xs">
                            {index + 1}
                          </span>
                          <span className="text-muted-foreground">{tip}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </>
            ) : (
              <div className="grid gap-3 sm:grid-cols-3" aria-hidden="true">
                {metricKeys.slice(0, 3).map((key) => (
                  <div key={key} className="rounded-2xl border border-dashed p-5">
                    <p className="text-sm text-muted-foreground">{reportMetricLabels[key]}</p>
                    <p className="mt-2 font-heading text-4xl font-bold text-muted-foreground/40">—</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section aria-labelledby="history">
            <h2 id="history" className="mb-4 text-2xl tracking-tight">
              Historique
            </h2>
            {reports.length ? (
              <ol className="divide-y overflow-hidden rounded-2xl border bg-card">
                {reports.map((report) => {
                  const current = report.id === selected?.id;
                  const deliveries = Object.entries(states)
                    .map(([state, label]) => ({
                      state,
                      label: label.toLowerCase(),
                      count: report.emails.filter((email) => email.state === state).length,
                    }))
                    .filter((item) => item.count > 0);
                  return (
                    <li key={report.id}>
                      <Link
                        href={`${base}/reports?report=${report.id}`}
                        aria-current={current ? "page" : undefined}
                        className={cn(
                          "relative flex items-center gap-4 px-4 py-3.5 outline-none transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50",
                          current && "bg-muted/60",
                        )}
                      >
                        {current && (
                          <span aria-hidden="true" className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-foreground" />
                        )}
                        <span
                          aria-hidden="true"
                          className={cn(
                            "flex size-11 shrink-0 flex-col items-center justify-center rounded-xl border leading-none",
                            current ? "border-primary bg-primary text-primary-foreground" : "bg-background",
                          )}
                        >
                          <span className="text-[9px] uppercase tracking-wider opacity-70">Sem.</span>
                          <span className="mt-0.5 font-heading text-base font-bold tabular-nums">
                            {isoWeek(new Date((report.weekStart.getTime() + report.weekEnd.getTime()) / 2))}
                          </span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium">
                            {reportRange(report.weekStart, report.weekEnd, timeZone)}
                          </span>
                          <span className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                            {report.skipped ? (
                              <span className="rounded-full border border-dashed px-2 py-px">
                                Sans activité · e-mail ignoré
                              </span>
                            ) : !deliveries.length ? (
                              <span className="rounded-full border px-2 py-px">Aucun destinataire vérifié</span>
                            ) : (
                              deliveries.map((item) => (
                                <span key={item.state} className="rounded-full border bg-background px-2 py-px tabular-nums">
                                  {item.count} {item.label}
                                </span>
                              ))
                            )}
                          </span>
                        </span>
                        {current ? (
                          <span className="hidden shrink-0 rounded-full bg-foreground px-2 py-0.5 text-[11px] text-background sm:inline">
                            Affiché
                          </span>
                        ) : (
                          <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                Aucun rapport généré pour le moment. Les semaines sans activité
                sont aussi couvertes, sauf si vous choisissez de les ignorer par
                e-mail.
              </p>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              Les 12 dernières semaines générées. « Accepté » confirme la prise
              en charge par le service e-mail, pas la réception ni l’ouverture.
              Les rapports sont figés au moment du calcul.
            </p>
          </section>

          <section aria-labelledby="definitions">
            <h2 id="definitions" className="mb-2 text-2xl tracking-tight">
              Comprendre vos indicateurs
            </h2>
            <Accordion type="multiple" className="w-full">
              {(Object.keys(explanations) as (keyof ReportMetrics)[]).map((key) => (
                <AccordionItem key={key} value={key}>
                  <AccordionTrigger className="text-left">{reportMetricLabels[key]}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">{explanations[key]}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
            <p className="mt-5 text-sm text-muted-foreground">
              Les pourcentages comparent deux semaines consécutives. Sans valeur
              de référence, aucun pourcentage n’est calculé. Une hausse du
              volume ou du nombre de réponses IA ne prouve ni une meilleure
              satisfaction ni une hausse du chiffre d’affaires.
            </p>
          </section>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-6">
          <section aria-labelledby="programmation" className="rounded-2xl border bg-card p-5">
            <h2 id="programmation" className="mb-5 text-lg">
              Programmation
            </h2>
            {eligible ? (
              <ReportSettingsForm
                referenceDate={now.toISOString()}
                projectId={projectId}
                initial={{
                  reportsEnabled: project.reportsEnabled,
                  reportsSkipEmpty: project.reportsSkipEmpty,
                  reportsIncludeTips: project.reportsIncludeTips,
                  reportsHourUtc: project.reportsHourUtc,
                }}
                version={project.reportsVersion}
              />
            ) : (
              <>
                <p className="mb-4 text-sm text-muted-foreground">
                  Les envois et les réglages reprendront avec un accès Business
                  valide. Votre historique reste consultable.
                </p>
                <Button asChild>
                  <Link href={`${base}/billing`}>Gérer l’abonnement</Link>
                </Button>
              </>
            )}
          </section>

          <section aria-labelledby="destinataires" className="rounded-2xl border bg-card p-5">
            <h2 id="destinataires" className="text-lg">
              Destinataires
            </h2>
            <ul className="mt-4 space-y-3">
              {recipients.map((recipient) => (
                <li key={recipient.id} className="flex min-w-0 items-start gap-3 text-sm">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted font-heading text-xs font-semibold">
                    {getInitials(recipient.user.name || recipient.user.email)}
                  </span>
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium">{recipient.user.name}</span>
                      <span className="rounded-full border px-1.5 text-[10px] text-muted-foreground">
                        {roleLabel[recipient.role] ?? recipient.role}
                      </span>
                    </span>
                    <span className="block break-all text-xs text-muted-foreground">
                      {recipient.user.email}
                    </span>
                    {!recipient.user.emailVerified && (
                      <span className="mt-1 block text-xs text-destructive">
                        Adresse à vérifier pour recevoir les rapports
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            <Button asChild variant="outline" size="sm" className="mt-5">
              <Link href={`${base}/team`}>Gérer l’équipe</Link>
            </Button>
            <p className="mt-3 text-xs text-muted-foreground">
              La liste suit les rôles du projet ; ils sont vérifiés avant chaque
              envoi.
            </p>
          </section>

          <section aria-labelledby="rituel" className="rounded-2xl bg-muted/40 p-5">
            <h2 id="rituel" className="text-lg">
              Un rituel de 10 minutes
            </h2>
            <ol className="mt-3 space-y-2.5 text-sm text-muted-foreground">
              {[
                "Repérez les échecs et les variations inhabituelles.",
                "Relisez quelques conversations avec votre équipe.",
                "Choisissez une seule amélioration de consigne à tester.",
                "Comparez plusieurs semaines avant de conclure.",
              ].map((step, index) => (
                <li key={step} className="flex gap-2.5">
                  <span className="font-mono text-xs text-foreground">0{index + 1}</span>
                  {step}
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </main>
  );
}
