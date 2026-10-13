import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CalendarClock, Mail, ArrowUpRight, ShieldCheck } from "lucide-react";
import { getSession } from "@/lib/auth-server";
import prisma from "@/lib/prisma";
import { getBillingAccess, formatBillingDate } from "@/lib/billing-access";
import {
  ReportSnapshotSchema,
  reportMetricLabels,
  reportDelta,
  reportRange,
  reportWindow,
  WEEK_MS,
  type ReportMetrics,
} from "@/lib/weekly-report";
import { Button } from "@/components/ui/button";
import { ReportSettingsForm } from "@/components/dashboard/project/report-settings";

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
export default async function ReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ report?: string | string[] }>;
}) {
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
      <main className="mx-auto max-w-3xl space-y-6 p-6 sm:p-10">
        <CalendarClock className="size-10 text-primary" />
        <p className="text-sm text-muted-foreground">BUSINESS</p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Votre semaine, en un rapport.
        </h1>
        <p className="text-muted-foreground">
          Recevez chaque lundi vos indicateurs, leur évolution et des pistes
          d’amélioration. Les rapports programmés sont inclus dans le plan
          Business et destinés aux Owner et Admin.
        </p>
        <Button asChild>
          <Link href={`${base}/billing`}>Découvrir le plan Business</Link>
        </Button>
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
  return (
    <main className="mx-auto max-w-7xl space-y-8 p-4 sm:p-6 xl:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm font-medium text-primary">
            Business · {project.name}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Rapports programmés
          </h1>
          <p className="max-w-2xl text-muted-foreground">
            Prenez du recul sur votre activité. Chaque semaine, les chiffres
            utiles et les prochaines actions arrivent dans votre boîte mail.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={`${base}/analytics`}>
            Explorer les statistiques <ArrowUpRight className="size-4" />
          </Link>
        </Button>
      </header>
      <section
        className="grid gap-6 rounded-xl border bg-muted/30 p-6 sm:grid-cols-3"
        aria-label="Programmation"
      >
        <div>
          <CalendarClock className="mb-3 size-5 text-primary" />
          <p className="font-medium">
            {!eligible
              ? "Abonnement à régulariser"
              : !project.reportsEnabled
                ? "Envois suspendus"
                : catchingUp
                  ? "Rapport à préparer"
                  : "Prochain envoi prévu"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {!eligible
              ? access.message
              : !project.reportsEnabled
                ? "Réactivez les rapports dans les réglages."
                : catchingUp
                  ? "La dernière semaine complète sera traitée au prochain passage du service."
                  : formatBillingDate(nextScheduled)}
          </p>
        </div>
        <div>
          <Mail className="mb-3 size-5 text-primary" />
          <p className="font-medium">
            {recipients.filter((r) => r.user.emailVerified).length}{" "}
            destinataire(s) éligible(s)
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Owner et Admin · adresses vérifiées · envois individuels
          </p>
        </div>
        <div>
          <ShieldCheck className="mb-3 size-5 text-primary" />
          <p className="font-medium">Données agrégées uniquement</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Aucun message client, numéro de téléphone ou pièce jointe dans les
            e-mails.
          </p>
        </div>
      </section>
      <div className="grid items-start gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <section aria-labelledby="report-preview">
            <div className="mb-5">
              <h2 id="report-preview" className="text-xl font-semibold">
                {selected
                  ? "Bilan de la semaine"
                  : "Votre premier rapport arrive bientôt"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {selected
                  ? `${reportRange(selected.weekStart, selected.weekEnd)} · UTC · comparaison avec les 7 jours précédents`
                  : "Les rapports couvrent le lundi à 00:00 jusqu’au lundi suivant à 00:00 UTC. Vous retrouverez ici les données dès le premier calcul."}
              </p>
            </div>
            {snapshot && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  {(
                    Object.keys(reportMetricLabels) as (keyof ReportMetrics)[]
                  ).map((key) => (
                    <div key={key} className="rounded-xl border p-5">
                      <h3 className="text-sm text-muted-foreground">
                        {reportMetricLabels[key]}
                      </h3>
                      <p className="mt-2 text-3xl font-semibold tabular-nums">
                        {snapshot.current[key].toLocaleString("fr-FR")}
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {reportDelta(
                          snapshot.current[key],
                          snapshot.previous[key],
                        )}{" "}
                        · précédent : {snapshot.previous[key]}
                      </p>
                    </div>
                  ))}
                </div>
                {snapshot.partial && (
                  <p className="mt-4 text-sm text-muted-foreground">
                    Projet récent : une partie des périodes comparées précède sa
                    création. Interprétez les variations avec prudence.
                  </p>
                )}
                {snapshot.tips.length > 0 && (
                  <div className="mt-6 rounded-xl bg-muted/40 p-5">
                    <h3 className="font-semibold">Pistes d’amélioration</h3>
                    <ul className="mt-3 list-disc space-y-3 pl-5 text-sm text-muted-foreground">
                      {snapshot.tips.map((tip) => (
                        <li key={tip}>{tip}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </section>
          <section aria-labelledby="history">
            <h2 id="history" className="mb-4 text-xl font-semibold">
              Historique des 12 dernières semaines générées
            </h2>
            {reports.length ? (
              <ul className="divide-y rounded-xl border">
                {reports.map((report) => (
                  <li
                    key={report.id}
                    className="flex flex-wrap items-center justify-between gap-3 p-4"
                  >
                    <Link
                      href={`${base}/reports?report=${report.id}`}
                      className="rounded text-sm font-medium underline-offset-4 hover:underline focus-visible:outline-ring"
                    >
                      {reportRange(report.weekStart, report.weekEnd)}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      {report.skipped
                        ? "Sans activité · e-mail ignoré"
                        : !report.emails.length
                          ? "Aucun destinataire vérifié"
                          : Object.entries(states)
                              .map(([state, label]) => {
                                const count = report.emails.filter(
                                  (email) => email.state === state,
                                ).length;
                                return count
                                  ? `${count} ${label.toLowerCase()}`
                                  : null;
                              })
                              .filter(Boolean)
                              .join(" · ")}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                Aucun rapport généré pour le moment. Les semaines sans activité
                sont aussi couvertes, sauf si vous choisissez de les ignorer par
                e-mail.
              </p>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              « Accepté » confirme la prise en charge par le service e-mail, pas
              la réception ou l’ouverture. Les rapports sont figés au moment du
              calcul.
            </p>
          </section>
          <section aria-labelledby="definitions">
            <h2 id="definitions" className="mb-4 text-xl font-semibold">
              Comprendre vos indicateurs
            </h2>
            <dl className="space-y-4">
              {(Object.keys(explanations) as (keyof ReportMetrics)[]).map(
                (key) => (
                  <div key={key}>
                    <dt className="text-sm font-medium">
                      {reportMetricLabels[key]}
                    </dt>
                    <dd className="mt-1 text-sm text-muted-foreground">
                      {explanations[key]}
                    </dd>
                  </div>
                ),
              )}
            </dl>
            <p className="mt-5 text-sm text-muted-foreground">
              Les pourcentages comparent deux semaines consécutives. Sans valeur
              de référence, aucun pourcentage n’est calculé. Une hausse du
              volume ou du nombre de réponses IA ne prouve ni une meilleure
              satisfaction ni une hausse du chiffre d’affaires.
            </p>
          </section>
        </div>
        <aside className="space-y-6">
          <section className="rounded-xl border p-5">
            <h2 className="mb-5 text-lg font-semibold">Programmation</h2>
            {eligible ? (
              <ReportSettingsForm
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
          <section className="rounded-xl border p-5">
            <h2 className="text-lg font-semibold">Destinataires</h2>
            <ul className="mt-4 space-y-4">
              {recipients.map((recipient) => (
                <li key={recipient.id} className="min-w-0 text-sm">
                  <p className="font-medium">
                    {recipient.user.name} · {recipient.role}
                  </p>
                  <p className="break-all text-muted-foreground">
                    {recipient.user.email}
                  </p>
                  {!recipient.user.emailVerified && (
                    <p className="mt-1 text-destructive">
                      Adresse à vérifier pour recevoir les rapports
                    </p>
                  )}
                </li>
              ))}
            </ul>
            <Button asChild variant="outline" className="mt-5">
              <Link href={`${base}/team`}>Gérer l’équipe</Link>
            </Button>
            <p className="mt-3 text-xs text-muted-foreground">
              La liste suit automatiquement les rôles du projet. Les changements
              de rôle sont vérifiés avant chaque envoi.
            </p>
          </section>
          <section className="rounded-xl bg-muted/40 p-5">
            <h2 className="font-semibold">Un rituel de 10 minutes</h2>
            <ol className="mt-3 list-decimal space-y-3 pl-5 text-sm text-muted-foreground">
              <li>Repérez les échecs et les variations inhabituelles.</li>
              <li>Relisez quelques conversations avec votre équipe.</li>
              <li>Choisissez une seule amélioration de consigne à tester.</li>
              <li>Comparez plusieurs semaines avant de conclure.</li>
            </ol>
          </section>
        </aside>
      </div>
    </main>
  );
}
