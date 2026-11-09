import type { Metadata } from "next";
import { can, homePath, roleLabel, rolesWith } from "@/lib/project-permissions";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  TriangleAlert,
} from "lucide-react";

import { LocalDate } from "@/components/local-date";
import { getSession } from "@/lib/auth-server";
import prisma from "@/lib/prisma";
import { getBillingAccess } from "@/lib/billing-access";
import { planAllows } from "@/lib/plan-features";
import { readIndicators } from "@/lib/report-indicators";
import { BASELINE_WEEKS, BAND_K } from "@/lib/report-signal";
import {
  emptyWeek,
  formatWeekClose,
  projectWeek,
  shortWeekRange,
} from "@/lib/report-week";
import { WAITING_CLOSE_UTC } from "@/lib/report-findings";
import { getUserTimeZone } from "@/lib/server-time-zone";
import {
  ReportSnapshotSchema,
  reportWindow,
  WEEK_MS,
  type ReportSnapshot,
} from "@/lib/weekly-report";
import { cn } from "@/lib/utils";
import { getInitials } from "@/components/getInitials";
import { Button } from "@/components/ui/button";
import { ReportSettingsForm } from "@/components/dashboard/project/report-settings";
import { BillingPlanButton } from "@/components/dashboard/project/billing-plan-button";
import {
  Definitions,
  FindingsList,
  HistoryList,
  IndicatorGrid,
  LegacyCounters,
  SectionHeader,
  VerdictPanel,
  WeekDetail,
  type ReportListItem,
} from "@/components/dashboard/project/reports/report-sections";

export const metadata: Metadata = {
  title: "Rapports programmés | ExtravertyAI",
  robots: { index: false, follow: false },
};
function parseSnapshot(value: unknown): ReportSnapshot | null {
  const parsed = ReportSnapshotSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

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
  if (!can(member.role, "stats.view"))
    redirect(homePath(projectId, member.role));
  const canManageReports = can(member.role, "reports.manage");
  const project = member.project;
  const access = await getBillingAccess(prisma, projectId);
  const eligible = planAllows(project.plan, "reports") && access.allowed;

  if (!planAllows(project.plan, "reports"))
    return (
      <main className="mx-auto grid w-full max-w-5xl items-center gap-12 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:py-16">
        <div>
          <p className="text-sm text-muted-foreground">Offre Business</p>
          <h1 className="mt-3 font-sans text-4xl font-semibold tracking-tight text-balance">
            Chaque lundi, ce qui a changé et quoi faire.
          </h1>
          <ul className="mt-6 space-y-2.5 text-sm text-muted-foreground">
            {[
              "Un verdict en une phrase",
              "Trois actions au plus, avec leur preuve",
              "Six indicateurs comparés à leur habitude",
              "Aucun message client dans l’e-mail",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2.5">
                <Check
                  aria-hidden="true"
                  className="size-4 shrink-0 text-foreground"
                />
                {item}
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            {can(member.role, "billing.manage") ? (
              <BillingPlanButton
                projectId={projectId}
                intent="upgrade"
                variant="default"
                label="Passer à l’offre Business"
              />
            ) : (
              <>
                {can(member.role, "billing.view") && (
                  <Button asChild>
                    <Link href={`${base}/billing`}>Voir l’offre Business</Link>
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">
                  Seuls le propriétaire et le rôle Facturation peuvent changer d’offre.
                </p>
              </>
            )}
          </div>
        </div>
        <figure
          aria-label="Exemple de rapport hebdomadaire"
          className="rounded-2xl border p-6 sm:p-8"
        >
          <div aria-hidden="true">
            <p className="flex items-center gap-2 text-xs font-medium text-destructive">
              <span className="size-1.5 rounded-full bg-destructive" />À
              surveiller
            </p>
            <p className="mt-3 text-xl leading-snug font-medium tracking-tight">
              14 questions sont restées sans réponse, contre 3 d’habitude.
            </p>
            <div className="mt-6 flex items-center justify-between gap-4 border-y py-4 text-sm">
              <span>Traiter les questions sur la livraison</span>
              <span className="rounded-md bg-primary px-2.5 py-1 text-xs text-primary-foreground">
                Ouvrir
              </span>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border">
              {[
                ["Autonomie de l’IA", "52 %", "Habitude 70 %"],
                ["Questions sans réponse", "14", "Habitude 3"],
              ].map(([label, value, note]) => (
                <div key={label} className="bg-background p-4">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="mt-1 text-2xl font-semibold tracking-tight">
                    {value}
                  </p>
                  <p className="text-xs text-muted-foreground">{note}</p>
                </div>
              ))}
            </div>
          </div>
          <figcaption className="mt-4 text-xs text-muted-foreground">
            Aperçu d’exemple · lundi, 08:00
          </figcaption>
        </figure>
      </main>
    );

  const requested = (await searchParams).report;
  const [reports, recipients] = await Promise.all([
    prisma.weeklyReport.findMany({
      where: { projectId },
      orderBy: { weekStart: "desc" },
      take: 12,
      include: { emails: { select: { id: true, state: true } } },
    }),
    prisma.projectMembership.findMany({
      where: { projectId, role: { in: rolesWith("stats.view") } },
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
          include: { emails: { select: { id: true, state: true } } },
        })
      : reports[0];
  if (typeof requested === "string" && !selected) notFound();

  const history: ReportListItem[] = reports.map((report) => {
    const snapshot = parseSnapshot(report.snapshot);
    return {
      id: report.id,
      // Semaines comptées depuis la création du projet : S1 est sa première semaine.
      label: `S${Math.max(1, projectWeek(report.weekStart, project.createdAt))}`,
      range: shortWeekRange(report.weekStart, report.weekEnd),
      skipped: report.skipped,
      emails: report.emails,
      verdict: snapshot?.version === 2 ? snapshot.verdict : null,
    };
  });
  const hrefFor = (id: string) =>
    `${base}/reports?report=${encodeURIComponent(id)}`;

  const now = new Date();
  const window = reportWindow(now, project.reportsHourUtc);
  const nextScheduled =
    project.createdAt >= window.end && now < window.due
      ? new Date(window.due.getTime() + WEEK_MS)
      : window.next;
  const catchingUp =
    !reports.some(
      (report) => report.weekStart.getTime() === window.start.getTime(),
    ) &&
    now >= window.due &&
    project.createdAt < window.end;
  const verified = recipients.filter((r) => r.user.emailVerified).length;

  const snapshot = selected ? parseSnapshot(selected.snapshot) : null;
  const v2 = snapshot?.version === 2 ? snapshot : null;
  // Un ancien instantané n'a que ses 8 compteurs : la grille l'indique sans rien mettre à 0.
  const weeks = v2 ? v2.weeks : selected ? [emptyWeek(selected)] : [];
  const index = weeks.length - 1;
  const readings = weeks.length ? readIndicators(weeks, index) : [];
  const week = weeks[index];
  // Clôture lue à l’heure de l’utilisateur, dans le bloc dédié comme dans
  // le constat figé (écrit en UTC pour l’e-mail).
  const closeLabel = week
    ? formatWeekClose(new Date(week.weekEnd), await getUserTimeZone())
    : "";
  const findings = (v2?.findings ?? []).map((finding) => ({
    ...finding,
    evidence: finding.evidence.map((line) =>
      line.replace(`, ${WAITING_CLOSE_UTC}`, ` à la clôture, ${closeLabel}`),
    ),
    action: { ...finding.action, href: `${base}${finding.action.href}` },
  }));
  const position = selected
    ? history.findIndex((item) => item.id === selected.id)
    : -1;
  const older = position >= 0 ? history[position + 1] : undefined;
  const newer = position > 0 ? history[position - 1] : undefined;

  return (
    <main className="mx-auto w-full max-w-5xl space-y-10 px-4 py-6 sm:space-y-12 sm:px-6 sm:py-10">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Rapport hebdomadaire</p>
          <h1 className="mt-1 font-sans text-2xl font-semibold tracking-tight sm:text-3xl">
            {selected
              ? `Semaine ${Math.max(1, projectWeek(selected.weekStart, project.createdAt))}`
              : "Rapports hebdomadaires"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {selected
              ? shortWeekRange(selected.weekStart, selected.weekEnd)
              : "Chaque lundi : ce qui a changé, où l’IA a passé la main et quoi faire."}
          </p>
        </div>
        <nav
          aria-label={selected ? "Changer de semaine" : "Raccourcis"}
          className="flex shrink-0 items-center gap-1.5 pt-5"
        >
          {selected ? (
            <>
              {older ? (
                <Button asChild variant="outline" size="icon-sm">
                  <Link
                    href={hrefFor(older.id)}
                    aria-label={`Semaine précédente (${older.label})`}
                  >
                    <ChevronLeft />
                  </Link>
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="icon-sm"
                  disabled
                  aria-label="Aucune semaine précédente"
                >
                  <ChevronLeft />
                </Button>
              )}
              {newer ? (
                <Button asChild variant="outline" size="icon-sm">
                  <Link
                    href={hrefFor(newer.id)}
                    aria-label={`Semaine suivante (${newer.label})`}
                  >
                    <ChevronRight />
                  </Link>
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="icon-sm"
                  disabled
                  aria-label="Aucune semaine suivante"
                >
                  <ChevronRight />
                </Button>
              )}
            </>
          ) : (
            <Button asChild variant="ghost" size="sm">
              <Link href={`${base}/analytics`}>Statistiques</Link>
            </Button>
          )}
        </nav>
      </header>

      {(!eligible || selected?.skipped) && (
        <div className="-mt-4 space-y-3 sm:-mt-6">
          {!eligible && (
            <div
              role="status"
              className="flex flex-wrap items-center gap-3 rounded-2xl border border-destructive/30 px-4 py-3 text-sm"
            >
              <TriangleAlert
                aria-hidden="true"
                className="size-4 shrink-0 text-destructive"
              />
              <p className="min-w-0 flex-1">
                Abonnement à régulariser : les envois sont suspendus,
                l’historique reste consultable.
              </p>
              <Button asChild size="sm" variant="outline">
                <Link href={`${base}/billing`}>Gérer l’abonnement</Link>
              </Button>
            </div>
          )}
          {selected?.skipped && (
            <p
              role="status"
              className="rounded-2xl border px-4 py-3 text-sm text-muted-foreground"
            >
              Semaine sans activité : l’e-mail n’a pas été envoyé, comme prévu
              dans la programmation.
            </p>
          )}
        </div>
      )}

      {!selected || !week ? (
        <section aria-labelledby="first-title" className="rounded-2xl border bg-card p-5 sm:p-6">
          <p className="text-xs font-medium text-muted-foreground">
            Aucun rapport pour le moment
          </p>
          <h2
            id="first-title"
            className="mt-2.5 max-w-3xl font-sans text-lg leading-snug font-medium tracking-tight text-pretty sm:text-xl"
          >
            Votre premier rapport arrivera après la première semaine complète.
          </h2>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
            Les comparaisons à l’habitude commencent après 4 semaines. Les
            semaines sans activité sont aussi couvertes, sauf si vous choisissez
            de ne pas les envoyer.
          </p>
        </section>
      ) : (
        <>
          {v2 ? (
            <VerdictPanel verdict={v2.verdict} partial={v2.partial} />
          ) : (
            <section aria-labelledby="legacy-title" className="rounded-2xl border bg-card p-5 sm:p-6">
              <p className="text-xs font-medium text-muted-foreground">Ancien format</p>
              <h2
                id="legacy-title"
                className="mt-2.5 max-w-3xl font-sans text-lg leading-snug font-medium tracking-tight text-pretty sm:text-xl"
              >
                Ce rapport date d’avant le nouveau format : il ne contient que
                les compteurs d’activité.
              </h2>
            </section>
          )}
          {v2 ? (
            <FindingsList findings={findings} />
          ) : snapshot?.version === 1 ? (
            <LegacyCounters
              current={snapshot.current}
              previous={snapshot.previous}
            />
          ) : null}
          <IndicatorGrid
            readings={readings}
            weeks={weeks}
            index={index}
            legacy={!v2}
            moreHref={`${base}/analytics`}
          />
          {v2 && (
            <>
              <WeekDetail week={week} base={base} closeLabel={closeLabel} />
              <LegacyCounters
                current={week.legacy}
                previous={weeks[index - 1]?.legacy ?? null}
              />
            </>
          )}
        </>
      )}

      {history.length > 0 && (
        <HistoryList
          reports={history}
          selectedId={selected?.id ?? ""}
          hrefFor={hrefFor}
        />
      )}

      <section
        aria-labelledby="sending-title"
        className="grid grid-cols-1 gap-10 border-t pt-10 md:grid-cols-2 md:gap-6"
      >
        <div className="min-w-0">
          <SectionHeader
            id="sending-title"
            title="Envoi par e-mail"
            meta={
              !eligible
                ? "Suspendue"
                : !project.reportsEnabled
                  ? "Envois suspendus"
                  : undefined
            }
          />
          {eligible ? (
            <>
              <p className="mb-5 text-sm text-muted-foreground">
                {!project.reportsEnabled ? (
                  "Réactivez les rapports pour reprendre les envois."
                ) : catchingUp ? (
                  "La dernière semaine complète sera traitée au prochain passage du service."
                ) : (
                  <>
                    Prochain envoi : <LocalDate value={nextScheduled} />
                  </>
                )}
              </p>
              {canManageReports ? (
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
                <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
                  Lecture seule : un administrateur règle l’heure et le contenu des envois.
                </p>
              )}
            </>
          ) : (
            <>
              <p className="mb-4 text-sm text-muted-foreground">
                {access.message}
              </p>
              {can(member.role, "billing.view") && (
                <Button asChild variant="outline" size="sm">
                  <Link href={`${base}/billing`}>Gérer l’abonnement</Link>
                </Button>
              )}
            </>
          )}
        </div>
        <div className="min-w-0">
          <SectionHeader
            id="recipients-title"
            title="Destinataires"
            meta={`${verified} adresse${verified > 1 ? "s" : ""} vérifiée${verified > 1 ? "s" : ""}`}
          />
          <ul className="divide-y rounded-2xl border px-4">
            {recipients.map((recipient) => (
              <li
                key={recipient.id}
                className="flex min-w-0 items-center gap-3 py-3 text-sm"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                  {getInitials(recipient.user.name || recipient.user.email)}
                </span>
                {/* Rôle à droite du nom, ou dessous s’il manque de place ; rien n’est tronqué. */}
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3">
                    <span className="min-w-0 wrap-anywhere">{recipient.user.name}</span>
                    <span
                      className={cn(
                        "shrink-0 text-xs",
                        recipient.user.emailVerified
                          ? "text-muted-foreground"
                          : "text-destructive",
                      )}
                    >
                      {recipient.user.emailVerified
                        ? roleLabel(recipient.role)
                        : "Adresse à vérifier"}
                    </span>
                  </span>
                  <span className="block text-xs wrap-anywhere text-muted-foreground">
                    {recipient.user.email}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          {can(member.role, "team.manage") && (
            <Button asChild variant="outline" size="sm" className="mt-4">
              <Link href={`${base}/team`}>Gérer l’équipe</Link>
            </Button>
          )}
        </div>
      </section>

      {readings.length > 0 && (
        <Definitions
          readings={readings}
          method={
            <ul className="list-disc space-y-1.5 pl-4">
              <li>
                Une semaine va du lundi 00:00 au dimanche 23:59 (UTC) ; la
                semaine 1 est celle de la création du projet.
              </li>
              <li>
                L’habitude est la médiane des {BASELINE_WEEKS} semaines
                précédentes ; la plage normale l’entoure de {BAND_K} écarts
                robustes.
              </li>
              <li>
                « Inhabituel » seulement hors de cette plage et au-delà du seuil
                d’effectif ; sous le seuil, l’écart est donné en valeur absolue.
              </li>
              <li>Chaque rapport est figé au moment du calcul.</li>
            </ul>
          }
        />
      )}
    </main>
  );
}
