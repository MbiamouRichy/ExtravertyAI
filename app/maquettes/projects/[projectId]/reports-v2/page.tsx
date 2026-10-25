// Page de test UI/UX du rapport hebdomadaire « outil de décision », avec des
// données synthétiques. La page Rapports réelle et son aperçu actuel
// (app/maquettes/projects/[projectId]/reports) ne sont pas modifiés.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowUpRight,
  CalendarClock,
  Check,
  FlaskConical,
  Lightbulb,
  Mail,
  ShieldCheck,
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

function TestBanner({ current, base }: { current: ScenarioId; base: string }) {
  return (
    <div role="note" className="rounded-xl border border-dashed p-4 text-sm">
      <p className="flex items-start gap-3">
        <FlaskConical aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <span>
          <strong className="font-medium">Page de test UI/UX.</strong>{" "}
          <span className="text-muted-foreground">
            Nouveau format du rapport, données synthétiques. La page Rapports
            actuelle n’est pas modifiée et rien n’est enregistré.
          </span>
        </span>
      </p>
      <nav aria-label="États à tester" className="mt-3">
        <ul className="flex flex-wrap gap-1.5">
          {scenarios.map((scenario) => (
            <li key={scenario.id}>
              <Link
                href={`${base}/reports-v2?etat=${scenario.id}`}
                aria-current={scenario.id === current ? "page" : undefined}
                className={cn(
                  "inline-flex rounded-full border px-2.5 py-1 text-xs outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
                  scenario.id === current &&
                    "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
                )}
              >
                {scenario.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

function UpsellPreview({ base }: { base: string }) {
  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 p-4 sm:p-8 lg:p-12">
      <TestBanner current="offre" base={base} />
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-xs tracking-wider text-muted-foreground uppercase">
            <CalendarClock aria-hidden="true" className="size-3.5" />
            Offre Business
          </p>
          <h1 className="mt-5 text-4xl md:text-5xl">
            Chaque lundi, quoi faire cette semaine.
          </h1>
          <p className="mt-4 max-w-md text-muted-foreground">
            Le rapport hebdomadaire dit si la semaine a été normale, où l’IA a
            passé la main et quelle action mener en priorité.
          </p>
          <ul className="mt-6 space-y-2 text-sm">
            {[
              "Un verdict en une phrase",
              "Trois constats au plus, avec leur preuve et l’action à mener",
              "Six indicateurs situés dans leur plage habituelle",
              "Données agrégées : aucun message client dans l’e-mail",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <Check aria-hidden="true" className="size-4 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <Link href="/maquettes/tarifs">Passer à l’offre Business</Link>
            </Button>
          </div>
        </div>
        <figure
          aria-label="Aperçu d’exemple d’un rapport hebdomadaire"
          className="rounded-3xl border bg-card p-6 shadow-xl shadow-foreground/5"
        >
          <figcaption className="mb-5 flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-mono tracking-wider uppercase">
              Aperçu d’exemple
            </span>
            <span>Lundi · 08:00</span>
          </figcaption>
          <div aria-hidden="true">
            <p className="inline-flex items-center gap-1.5 rounded-full border border-destructive/40 px-2.5 py-1 text-xs font-medium text-destructive">
              <TriangleAlert className="size-3.5" />À surveiller
            </p>
            <p className="mt-3 font-heading text-lg leading-snug font-semibold">
              14 questions sont restées sans réponse, contre 3 d’habitude ; l’IA
              a mené seule 52 % des 40 conversations (70 % d’habitude).
            </p>
            <div className="mt-4 rounded-xl border p-3 text-xs">
              <p className="font-medium">
                1 · Répondre aux 14 questions sur la livraison
              </p>
              <p className="mt-1 text-muted-foreground">
                Habitude : 3 par semaine, plage normale 0 à 7
              </p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {[
                ["Autonomie de l’IA", "52 %", "Plage normale 47–93 %"],
                ["Questions sans réponse", "14", "Inhabituel"],
              ].map(([label, value, note]) => (
                <div key={label} className="rounded-xl border p-3">
                  <p className="text-[11px] text-muted-foreground">{label}</p>
                  <p className="mt-1 font-heading text-xl font-bold">{value}</p>
                  <p className="text-[11px] text-muted-foreground">{note}</p>
                </div>
              ))}
            </div>
          </div>
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

  return (
    <main className="mx-auto w-full max-w-7xl space-y-8 p-4 sm:p-6 xl:p-8">
      <TestBanner current={scenarioId} base={base} />

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs tracking-wider text-muted-foreground uppercase">
            Business · {project.name}
          </p>
          <h1 className="mt-2 text-3xl md:text-4xl">Rapport de la semaine</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Le verdict d’abord, puis les actions. Pour explorer les chiffres en
            détail, ouvrez les statistiques.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={`${base}/analytics`}>
            Explorer les statistiques <ArrowUpRight data-icon="inline-end" />
          </Link>
        </Button>
      </header>

      {!scenario.eligible && (
        <div
          role="status"
          className="flex flex-wrap items-center gap-3 rounded-2xl border border-destructive/40 p-4 text-sm"
        >
          <TriangleAlert
            aria-hidden="true"
            className="size-4 shrink-0 text-destructive"
          />
          <p className="min-w-0 flex-1">
            <strong className="font-medium">Abonnement à régulariser.</strong>{" "}
            <span className="text-muted-foreground">
              Les envois sont suspendus ; l’historique reste consultable.
            </span>
          </p>
          <Button asChild size="sm" variant="outline">
            <Link href={`${appBase}/billing`}>Gérer l’abonnement</Link>
          </Button>
        </div>
      )}
      {selected.skipped && (
        <p
          role="status"
          className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground"
        >
          Semaine sans activité : l’e-mail n’a pas été envoyé, comme prévu par
          le réglage « Ignorer les semaines sans activité ».
        </p>
      )}

      {legacy || !selected.verdict ? (
        <section
          aria-labelledby="legacy-title"
          className="rounded-2xl border border-dashed bg-card p-5 sm:p-7"
        >
          <p className="inline-flex rounded-full border border-dashed px-2.5 py-1 text-xs font-medium text-muted-foreground">
            Ancien format
          </p>
          <h2
            id="legacy-title"
            className="mt-4 max-w-3xl font-heading text-xl leading-snug font-semibold sm:text-2xl"
          >
            Ce rapport date d’avant le nouveau format : il ne contient que les 8
            compteurs d’activité.
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            {selected.label} · {selected.range} (heures UTC). Les indicateurs
            ci-dessous n’étaient pas mesurés à l’époque : ils ne sont pas
            affichés à 0.
          </p>
        </section>
      ) : (
        <VerdictPanel
          verdict={selected.verdict}
          report={selected}
          partial={partial}
        />
      )}

      <div className="grid items-start gap-8 lg:grid-cols-3">
        <div className="min-w-0 space-y-10 lg:col-span-2">
          {legacy ? (
            <LegacyCounters
              current={week.legacy}
              previous={previous?.legacy ?? null}
              open
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
          <Definitions readings={readings} />
        </div>

        <aside className="min-w-0 space-y-6 lg:sticky lg:top-6">
          <section
            aria-labelledby="sending-title"
            className="rounded-2xl border bg-card p-5"
          >
            <h2 id="sending-title" className="text-lg">
              Envoi
            </h2>
            <ul className="mt-4 space-y-4 text-sm">
              <li className="flex gap-3">
                <CalendarClock
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0"
                />
                <span>
                  <span className="block font-medium">
                    {scenario.eligible
                      ? "Prochain envoi"
                      : "Abonnement à régulariser"}
                  </span>
                  <span className="text-muted-foreground">
                    {scenario.eligible ? (
                      <LocalDate value={nextScheduled} />
                    ) : (
                      "Les envois reprendront avec un accès Business valide."
                    )}
                  </span>
                </span>
              </li>
              <li className="flex gap-3">
                <Mail aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                <span>
                  <span className="block font-medium">
                    {verified} destinataire{verified > 1 ? "s" : ""} éligible
                    {verified > 1 ? "s" : ""}
                  </span>
                  <span className="text-muted-foreground">
                    Adresses vérifiées, envois individuels.
                  </span>
                </span>
              </li>
              <li className="flex gap-3">
                <ShieldCheck
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0"
                />
                <span>
                  <span className="block font-medium">
                    Données agrégées uniquement
                  </span>
                  <span className="text-muted-foreground">
                    Aucun message client, numéro ou question dans l’e-mail.
                  </span>
                </span>
              </li>
            </ul>
          </section>

          <section
            aria-labelledby="programmation"
            className="rounded-2xl border bg-card p-5"
          >
            <h2 id="programmation" className="mb-5 text-lg">
              Programmation
            </h2>
            {scenario.eligible ? (
              <>
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
              <>
                <p className="mb-4 text-sm text-muted-foreground">
                  Les envois et les réglages reprendront avec un accès Business
                  valide. Votre historique reste consultable.
                </p>
                <Button asChild>
                  <Link href={`${appBase}/billing`}>Gérer l’abonnement</Link>
                </Button>
              </>
            )}
          </section>

          <section
            aria-labelledby="destinataires"
            className="rounded-2xl border bg-card p-5"
          >
            <h2 id="destinataires" className="text-lg">
              Destinataires
            </h2>
            <ul className="mt-4 space-y-3">
              {recipients.map((recipient) => (
                <li
                  key={recipient.id}
                  className="flex min-w-0 items-start gap-3 text-sm"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted font-heading text-xs font-semibold">
                    {getInitials(recipient.name)}
                  </span>
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium">{recipient.name}</span>
                      <span className="rounded-full border px-1.5 text-[10px] text-muted-foreground">
                        {roleLabel[recipient.role]}
                      </span>
                    </span>
                    <span className="block text-xs break-all text-muted-foreground">
                      {recipient.email}
                    </span>
                    {!recipient.verified && (
                      <span className="mt-1 block text-xs text-destructive">
                        Adresse à vérifier pour recevoir les rapports
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            <Button asChild variant="outline" size="sm" className="mt-5">
              <Link href={`${appBase}/team`}>Gérer l’équipe</Link>
            </Button>
          </section>

          <section
            aria-labelledby="lecture"
            className="rounded-2xl border bg-card p-5"
          >
            <h2 id="lecture" className="flex items-center gap-2 text-lg">
              <Lightbulb aria-hidden="true" className="size-4" />
              Comment lire ce rapport
            </h2>
            <ul className="mt-3 space-y-2.5 text-sm text-muted-foreground">
              <li>
                L’habitude est la médiane des {BASELINE_WEEKS} semaines
                précédentes ; la plage normale l’entoure de {BAND_K} écarts
                robustes, élargie quand l’effectif est petit.
              </li>
              <li>
                Une valeur n’est « inhabituelle » que hors de cette plage et
                au-delà du seuil d’effectif.
              </li>
              <li>
                Sous le seuil, seul l’écart absolu est donné (« 1 → 3 »), sans
                pourcentage.
              </li>
              <li>Semaines du lundi 00:00 au dimanche 23:59, en heure UTC.</li>
            </ul>
          </section>
        </aside>
      </div>
    </main>
  );
}
