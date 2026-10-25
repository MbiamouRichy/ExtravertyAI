// Page de test UI/UX du rapport hebdomadaire « outil de décision », avec des
// données synthétiques. La page Rapports réelle et son aperçu actuel
// (app/maquettes/projects/[projectId]/reports) ne sont pas modifiés.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  TriangleAlert,
} from "lucide-react";

import { LocalDate } from "@/components/local-date";
import { getInitials } from "@/components/getInitials";
import { Button } from "@/components/ui/button";
import { ReportSettingsForm } from "@/components/dashboard/project/report-settings";
import { reportWindow, WEEK_MS } from "@/lib/weekly-report";
import { cn } from "@/lib/utils";
import { buildFindings } from "@/components/maquettes/reports-v2/findings";
import { readIndicators } from "@/components/maquettes/reports-v2/indicators";
import {
  Definitions,
  FindingsList,
  HistoryList,
  IndicatorGrid,
  LegacyCounters,
  SectionHeader,
  VerdictPanel,
  WeekDetail,
} from "@/components/maquettes/reports-v2/report-sections";
import {
  buildScenario,
  parseScenario,
  scenarios,
  type ScenarioId,
} from "@/components/maquettes/reports-v2/scenario";
import {
  BAND_K,
  BASELINE_WEEKS,
} from "@/components/maquettes/reports-v2/signal";

export const metadata: Metadata = {
  title: "Rapport de décision (test)",
  robots: { index: false, follow: false },
};

const project = {
  name: "Boutique Démo",
  reportsEnabled: true,
  reportsSkipEmpty: true,
  reportsIncludeTips: true,
  reportsHourUtc: 7,
  reportsVersion: 1,
};
const recipients = [
  {
    id: "r1",
    role: "OWNER",
    name: "Paul Mbia",
    email: "paul@exemple.com",
    verified: true,
  },
  {
    id: "r2",
    role: "ADMIN",
    name: "Inès Fotso",
    email: "ines@exemple.com",
    verified: true,
  },
  {
    id: "r3",
    role: "ADMIN",
    name: "Marc Tchoua",
    email: "marc@exemple.com",
    verified: false,
  },
];
const roleLabel: Record<string, string> = {
  OWNER: "Propriétaire",
  ADMIN: "Administrateur",
};

function TestBar({ current, base }: { current: ScenarioId; base: string }) {
  return (
    <nav
      aria-label="États à tester"
      className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b pb-4 text-xs"
    >
      <span className="font-medium">Page de test · données synthétiques</span>
      <ul className="flex flex-wrap gap-x-3 gap-y-1.5">
        {scenarios.map((scenario) => (
          <li key={scenario.id}>
            <Link
              href={`${base}/reports-v2?etat=${scenario.id}`}
              aria-current={scenario.id === current ? "page" : undefined}
              className={cn(
                "rounded-sm text-muted-foreground underline-offset-4 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
                scenario.id === current && "text-foreground underline",
              )}
            >
              {scenario.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function UpsellPreview({ base }: { base: string }) {
  return (
    <main className="mx-auto w-full max-w-5xl space-y-16 px-4 py-6 sm:px-6 sm:py-10">
      <TestBar current="offre" base={base} />
      <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.1fr]">
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
          <Button asChild className="mt-8">
            <Link href="/maquettes/tarifs">Passer à l’offre Business</Link>
          </Button>
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
            Exemple · lundi, 08:00
          </figcaption>
        </figure>
      </div>
    </main>
  );
}

export default async function ReportsDecisionPreview({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{
    report?: string | string[];
    etat?: string | string[];
  }>;
}) {
  const [{ projectId: rawId }, query] = await Promise.all([
    params,
    searchParams,
  ]);
  const projectId = rawId.slice(0, 64);
  const base = `/maquettes/projects/${encodeURIComponent(projectId)}`;
  // Les actions pointent vers les vraies pages de l'application.
  const appBase = `/projects/${encodeURIComponent(projectId)}`;
  const scenarioId = parseScenario(query.etat);
  const now = new Date();
  const scenario = buildScenario(scenarioId, now);
  if (!scenario.business) return <UpsellPreview base={base} />;

  const requested = typeof query.report === "string" ? query.report : undefined;
  const selected = requested
    ? scenario.reports.find((report) => report.id === requested)
    : scenario.fallback;
  if (!selected) notFound();
  const { week } = selected;
  const legacy = selected.version === 1;
  const readings = readIndicators(scenario.weeks, selected.index);
  const findings = legacy
    ? []
    : buildFindings(readings, week, selected.range, appBase);
  const previous = scenario.weeks[selected.index - 1] ?? null;
  const partial = scenario.projectCreatedAt > week.weekStart;

  const window = reportWindow(now, project.reportsHourUtc);
  const nextScheduled =
    now < window.due ? window.due : new Date(window.due.getTime() + WEEK_MS);
  const verified = recipients.filter((r) => r.verified).length;
  const hrefFor = (id: string) =>
    `${base}/reports-v2?etat=${scenarioId}&report=${id}`;
  // Rapports du plus récent au plus ancien : « précédent » est plus loin dans la liste.
  const position = scenario.reports.findIndex(
    (report) => report.id === selected.id,
  );
  const older = scenario.reports[position + 1];
  const newer = scenario.reports[position - 1];

  return (
    <main className="mx-auto w-full max-w-5xl space-y-14 px-4 py-6 sm:px-6 sm:py-10">
      <TestBar current={scenarioId} base={base} />

      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-sm text-muted-foreground">
            {project.name} · Rapport hebdomadaire
          </p>
          <h1 className="mt-1 font-sans text-3xl font-semibold tracking-tight">
            Semaine {selected.label.slice(1)}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {selected.range} · heures UTC · comparée aux {BASELINE_WEEKS}{" "}
            semaines précédentes
          </p>
        </div>
        <div className="flex items-center gap-2">
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
          <Button asChild variant="ghost" size="sm">
            <Link href={`${base}/analytics`}>
              Statistiques <ArrowUpRight data-icon="inline-end" />
            </Link>
          </Button>
        </div>
      </header>

      {(!scenario.eligible || selected.skipped) && (
        <div className="-mt-6 space-y-3">
          {!scenario.eligible && (
            <div
              role="status"
              className="flex flex-wrap items-center gap-3 rounded-xl border border-destructive/30 px-4 py-3 text-sm"
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
                <Link href={`${appBase}/billing`}>Gérer l’abonnement</Link>
              </Button>
            </div>
          )}
          {selected.skipped && (
            <p
              role="status"
              className="rounded-xl border px-4 py-3 text-sm text-muted-foreground"
            >
              Semaine sans activité : l’e-mail n’a pas été envoyé, comme prévu
              dans la programmation.
            </p>
          )}
        </div>
      )}

      {legacy || !selected.verdict ? (
        <section aria-labelledby="legacy-title">
          <p className="text-sm text-muted-foreground">Ancien format</p>
          <h2
            id="legacy-title"
            className="mt-3 max-w-4xl font-sans text-2xl leading-tight font-medium tracking-tight text-balance sm:text-[2rem]"
          >
            Ce rapport date d’avant le nouveau format : il ne contient que les
            compteurs d’activité.
          </h2>
        </section>
      ) : (
        <VerdictPanel verdict={selected.verdict} partial={partial} />
      )}

      {legacy ? (
        <LegacyCounters
          current={week.legacy}
          previous={previous?.legacy ?? null}
        />
      ) : (
        <FindingsList findings={findings} />
      )}
      <IndicatorGrid
        readings={readings}
        weeks={scenario.weeks}
        index={selected.index}
        legacy={legacy}
      />
      {!legacy && (
        <>
          <WeekDetail week={week} base={appBase} />
          <LegacyCounters
            current={week.legacy}
            previous={previous?.legacy ?? null}
          />
        </>
      )}
      <HistoryList
        reports={scenario.reports}
        selectedId={selected.id}
        hrefFor={hrefFor}
      />

      <section
        aria-labelledby="sending-title"
        className="grid gap-10 border-t pt-10 md:grid-cols-2"
      >
        <div>
          <SectionHeader
            id="sending-title"
            title="Programmation"
            meta={scenario.eligible ? undefined : "Suspendue"}
          />
          {scenario.eligible ? (
            <>
              <p className="mb-5 text-sm text-muted-foreground">
                Prochain envoi : <LocalDate value={nextScheduled} />
              </p>
              <fieldset disabled aria-describedby="preview-settings-note">
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
              </fieldset>
              <p
                id="preview-settings-note"
                className="mt-3 text-xs text-muted-foreground"
              >
                Aperçu : réglages désactivés, rien n’est enregistré.
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Les envois et les réglages reprendront avec un accès Business
              valide.
            </p>
          )}
        </div>
        <div>
          <SectionHeader
            id="recipients-title"
            title="Destinataires"
            meta={`${verified} adresse${verified > 1 ? "s" : ""} vérifiée${verified > 1 ? "s" : ""}`}
          />
          <ul className="divide-y border-y">
            {recipients.map((recipient) => (
              <li
                key={recipient.id}
                className="flex min-w-0 items-center gap-3 py-3 text-sm"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                  {getInitials(recipient.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{recipient.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {recipient.email}
                  </span>
                </span>
                <span
                  className={cn(
                    "shrink-0 text-xs",
                    recipient.verified
                      ? "text-muted-foreground"
                      : "text-destructive",
                  )}
                >
                  {recipient.verified
                    ? roleLabel[recipient.role]
                    : "À vérifier"}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            Propriétaires et administrateurs, envois individuels. Aucun message,
            numéro ni question client dans l’e-mail.
          </p>
          <Button asChild variant="outline" size="sm" className="mt-4">
            <Link href={`${appBase}/team`}>Gérer l’équipe</Link>
          </Button>
        </div>
      </section>

      <div className="grid gap-10 md:grid-cols-[1.4fr_1fr]">
        <Definitions readings={readings} />
        <section aria-labelledby="method-title">
          <SectionHeader id="method-title" title="Méthode" />
          <ul className="space-y-2.5 text-sm text-muted-foreground">
            <li>
              L’habitude est la médiane des {BASELINE_WEEKS} semaines
              précédentes ; la plage normale l’entoure de {BAND_K} écarts
              robustes.
            </li>
            <li>
              « Inhabituel » seulement hors de cette plage et au-delà du seuil
              d’effectif.
            </li>
            <li>
              Sous le seuil, l’écart est donné en valeur absolue, sans
              pourcentage.
            </li>
          </ul>
        </section>
      </div>
    </main>
  );
}
