import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  Info,
  TriangleAlert,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollFadeArea } from "@/components/dashboard/project/scroll-fade-area";

import { cn } from "@/lib/utils";
import { reportMetricLabels, type ReportMetrics } from "@/lib/weekly-report";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

import type { WeekAggregate } from "@/lib/report-week";
import {
  confidenceLabel,
  formatBand,
  formatCount,
  formatDuration,
  formatValue,
  type Finding,
  type Verdict,
} from "@/lib/report-findings";
import type { IndicatorKey, IndicatorReading } from "@/lib/report-indicators";
import { weekNote } from "@/lib/report-week";
import { BASELINE_WEEKS, type SignalStatus } from "@/lib/report-signal";
import { ReportSparkline, type SparkPoint } from "./sparkline";

const percent = new Intl.NumberFormat("fr-FR", {
  style: "percent",
  maximumFractionDigits: 0,
});
const integer = new Intl.NumberFormat("fr-FR");
// Semaines repérées par leur lundi (UTC, comme les rapports), jamais par un
// numéro de calendrier qui ne parle à personne.
const day = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

/**
 * Titre de section : la hiérarchie vient de l'espace et des cadres légers.
 * Sur mobile la précision passe sous le titre, sur toute la largeur.
 */
export function SectionHeader({
  id,
  title,
  meta,
}: {
  id: string;
  title: string;
  meta?: string;
}) {
  return (
    <div className="mb-3 flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <h2 id={id} className="shrink-0 font-sans text-base font-semibold tracking-tight">
        {title}
      </h2>
      {meta && (
        <p className="min-w-0 text-xs text-muted-foreground sm:text-right">{meta}</p>
      )}
    </div>
  );
}

function Dot({ tone }: { tone: "bad" | "good" | "neutral" }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block size-1.5 shrink-0 rounded-full",
        tone === "bad" && "bg-destructive",
        tone === "good" && "bg-foreground",
        tone === "neutral" && "bg-muted-foreground/50",
      )}
    />
  );
}

/** Ligne libellé → valeur des blocs de détail. */
function Row({
  label,
  value,
  alert = false,
}: {
  label: ReactNode;
  value: ReactNode;
  alert?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2 text-sm">
      <dt className="min-w-0 text-muted-foreground">{label}</dt>
      <dd className={cn("shrink-0 font-medium tabular-nums", alert && "text-destructive")}>
        {value}
      </dd>
    </div>
  );
}

/** Le résumé de la semaine, lisible en premier. */
export function VerdictPanel({
  verdict,
  partial,
}: {
  verdict: Verdict;
  partial: boolean;
}) {
  const watch = verdict.tone === "watch";
  return (
    <section
      aria-labelledby="verdict-title"
      className={cn(
        "rounded-2xl border bg-card p-5 sm:p-6",
        watch && "border-destructive/40",
      )}
    >
      <p
        className={cn(
          "flex items-center gap-2 text-xs font-medium",
          watch
            ? "text-destructive"
            : verdict.tone === "good"
              ? "text-foreground"
              : "text-muted-foreground",
        )}
      >
        <Dot tone={watch ? "bad" : verdict.tone === "good" ? "good" : "neutral"} />
        {verdict.label}
      </p>
      <h2
        id="verdict-title"
        className="mt-2.5 max-w-3xl font-sans text-lg leading-snug font-medium tracking-tight text-pretty sm:text-xl"
      >
        {verdict.sentence}
      </h2>
      {partial && (
        <p className="mt-3 text-xs text-muted-foreground">
          Semaine incomplète : le projet a été créé en cours de semaine.
        </p>
      )}
    </section>
  );
}

export function FindingsList({ findings }: { findings: Finding[] }) {
  return (
    <section aria-labelledby="findings-title">
      <SectionHeader
        id="findings-title"
        title="À faire cette semaine"
        meta={
          findings.length
            ? `${findings.length} action${findings.length > 1 ? "s" : ""}, la plus utile en premier`
            : undefined
        }
      />
      {findings.length ? (
        <ol className="divide-y rounded-2xl border">
          {findings.map((finding, index) => {
            const impact = Math.round(finding.impact);
            return (
              // Sur mobile le rang passe dans le titre : le texte garde toute la largeur.
              <li
                key={finding.id}
                className="grid grid-cols-1 items-start gap-3 p-4 sm:p-5 md:grid-cols-[1.5rem_minmax(0,1fr)_auto] md:gap-x-3"
              >
                <span
                  aria-hidden="true"
                  className="hidden size-6 items-center justify-center rounded-full bg-muted font-mono text-xs md:flex"
                >
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <h3 className="font-sans text-sm leading-snug font-medium tracking-normal text-pretty sm:text-base">
                    <span
                      aria-hidden="true"
                      className="mr-2 inline-flex size-5 items-center justify-center rounded-full bg-muted align-[0.1em] font-mono text-[11px] md:hidden"
                    >
                      {index + 1}
                    </span>
                    {finding.title}
                  </h3>
                  <p className="mt-1 text-sm text-pretty text-muted-foreground">
                    {finding.evidence.join(" · ")}
                  </p>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    ≈ {formatCount(impact, "conversation concernée", "conversations concernées")}
                    {" · "}
                    {confidenceLabel[finding.confidence]}
                  </p>
                </div>
                {/* Un libellé long passe à la ligne plutôt que de déborder. */}
                <Button
                  asChild
                  size="sm"
                  variant={index === 0 ? "default" : "outline"}
                  className="h-auto min-h-8 max-w-full justify-self-start py-1.5 text-left whitespace-normal md:col-start-3 md:self-center"
                >
                  <Link href={finding.action.href}>
                    {finding.action.label}
                    <ArrowRight data-icon="inline-end" />
                  </Link>
                </Button>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="rounded-2xl border p-4 text-sm text-muted-foreground sm:p-5">
          Rien d’urgent cette semaine. Relisez deux ou trois conversations menées
          par l’IA et précisez une consigne si besoin.
        </p>
      )}
    </section>
  );
}

const statusSentence: Record<SignalStatus, string> = {
  "unusual-bad": "hors de la plage normale, dans le mauvais sens",
  "unusual-good": "hors de la plage normale, dans le bon sens",
  usual: "dans la plage normale",
  "low-sample": "effectif trop faible pour comparer",
  "insufficient-history": "historique insuffisant pour comparer",
  "not-measured": "non mesuré à l’époque",
};

/** Ce que mesure la valeur de la semaine, en une ligne. */
function detail(key: IndicatorKey, week: WeekAggregate) {
  const { outcome, conversations: n } = week;
  switch (key) {
    case "autonomy":
      return n
        ? `${integer.format(outcome.autonomous)} sur ${formatCount(n, "conversation", "conversations")}`
        : "Aucune conversation";
    case "handover":
      return n
        ? `${integer.format(outcome.handover)} sur ${formatCount(n, "conversation", "conversations")}`
        : "Aucune conversation";
    case "gaps":
      return `${formatCount(week.gapsOpenAtClose, "encore ouverte", "encore ouvertes")} à la clôture`;
    case "aiReply":
      return week.aiReply.n
        ? `9 clients sur 10 en moins de ${formatDuration(week.aiReply.p90)}${week.teamReply.n ? ` · équipe : ${formatDuration(week.teamReply.median)}` : ""}`
        : "Aucune réponse de l’IA";
    case "csat":
      return week.csat.sent
        ? `${formatCount(week.csat.responses, "réponse", "réponses")} sur ${formatCount(week.csat.sent, "questionnaire", "questionnaires")}`
        : "Aucun questionnaire envoyé";
    case "failures":
      return `${formatCount(week.sends.failed, "envoi", "envois")} · ${formatCount(week.aiJobsFailed, "réponse IA", "réponses IA")}`;
  }
}

/** Comparaison à l’habitude ; rien tant que l’historique est trop court (dit une fois pour toutes). */
function comparison(
  reading: IndicatorReading,
): { text: string; tone: "bad" | "good" | "muted" } | null {
  const { status, band } = reading.signal;
  const { kind, minSample } = reading.definition;
  const habit = band
    ? `habitude ${formatValue(kind, kind === "count" ? Math.round(band.median) : band.median)}`
    : null;
  switch (status) {
    case "unusual-bad":
      return { text: `Inhabituel${habit ? ` · ${habit}` : ""}`, tone: "bad" };
    case "unusual-good":
      return { text: `Mieux que d’habitude${habit ? ` · ${habit}` : ""}`, tone: "good" };
    case "usual":
      return { text: `Habituel${band ? ` · ${formatBand(kind, band)}` : ""}`, tone: "muted" };
    case "low-sample":
      if (kind === "count" && reading.previous?.value != null && reading.current.value != null)
        return {
          text: `${formatValue(kind, reading.previous.value)} la semaine précédente`,
          tone: "muted",
        };
      return {
        text: `Trop peu de données pour comparer (${reading.current.n} sur ${minSample})`,
        tone: "muted",
      };
    case "not-measured":
      return { text: "Non mesuré à l’époque", tone: "muted" };
    case "insufficient-history":
      return null;
  }
}

function sparkPoints(
  reading: IndicatorReading,
  weeks: WeekAggregate[],
  offset: number,
): SparkPoint[] {
  return reading.series.map((point, i) => ({
    label: day.format(point.weekStart),
    range: `semaine du ${day.format(point.weekStart)}`,
    value: point.value,
    display:
      point.value === null
        ? "Non mesuré"
        : formatValue(reading.definition.kind, point.value),
    flagged:
      point.status === "unusual-bad"
        ? "bad"
        : point.status === "unusual-good"
          ? "good"
          : null,
    note: weekNote(weeks[offset + i]),
  }));
}

/**
 * Les six indicateurs en liste : nom et contexte à gauche, tendance, valeur à
 * droite. Une ligne par indicateur se lit d’un coup d’œil, du téléphone à l’écran large.
 */
export function IndicatorGrid({
  readings,
  weeks,
  index,
  legacy = false,
  moreHref,
}: {
  readings: IndicatorReading[];
  weeks: WeekAggregate[];
  index: number;
  /** Ancien instantané (v1) : ces indicateurs n'y figurent pas, rien n'est affiché à 0. */
  legacy?: boolean;
  /** Lien vers les statistiques détaillées. */
  moreHref?: string;
}) {
  const week = weeks[index];
  const offset = index - readings[0].series.length + 1;
  // Une tendance demande au moins deux semaines.
  const trend = !legacy && readings[0].series.length > 1;
  const notes = trend
    ? readings[0].series
        .map((point, i) => ({
          label: `semaine du ${day.format(point.weekStart)}`,
          note: weekNote(weeks[offset + i]),
        }))
        .filter((item) => item.note)
    : [];
  const early =
    !legacy &&
    readings.every((reading) =>
      ["insufficient-history", "not-measured"].includes(reading.signal.status),
    );

  return (
    <section aria-labelledby="indicators-title">
      <SectionHeader
        id="indicators-title"
        title="Indicateurs"
        meta={
          legacy
            ? "Absents de ce rapport (ancien format)"
            : early
              ? "Comparaison à l’habitude après 4 semaines complètes"
              : `Comparés aux ${BASELINE_WEEKS} semaines précédentes`
        }
      />
      <ul className="divide-y rounded-2xl border">
        {readings.map((reading) => {
          const { definition, current } = reading;
          const status: SignalStatus = legacy ? "not-measured" : reading.signal.status;
          const values = reading.series.flatMap((p) => (p.value === null ? [] : [p.value]));
          const value =
            current.value === null || legacy ? "—" : formatValue(definition.kind, current.value);
          const compare = legacy ? null : comparison(reading);
          const summary = values.length
            ? `${definition.label}, ${reading.series.length} dernières semaines : entre ${formatValue(definition.kind, Math.min(...values))} et ${formatValue(definition.kind, Math.max(...values))}. Cette semaine : ${value}, ${statusSentence[status]}.`
            : `${definition.label} : aucune valeur sur la période.`;
          return (
            <li
              key={definition.key}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-1.5 p-4 sm:px-5 md:grid-cols-[minmax(0,1fr)_10rem_7rem] md:items-center"
            >
              <div className="row-span-2 min-w-0 md:row-span-1">
                <div className="flex items-center gap-0.5">
                  <h3 className="font-sans text-sm font-medium tracking-normal">
                    {definition.label}
                  </h3>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="text-muted-foreground"
                        aria-label={`À quoi sert « ${definition.label} » ?`}
                      >
                        <Info />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-64 leading-relaxed">
                      {purpose[definition.key]}
                    </TooltipContent>
                  </Tooltip>
                </div>
                <p className="text-xs text-muted-foreground">
                  {legacy ? "Indicateur absent de ce rapport" : detail(definition.key, week)}
                </p>
                {compare && (
                  <p
                    className={cn(
                      "mt-1 flex items-center gap-1 text-xs",
                      compare.tone === "bad"
                        ? "font-medium text-destructive"
                        : compare.tone === "good"
                          ? "font-medium text-foreground"
                          : "text-muted-foreground",
                    )}
                  >
                    {compare.tone === "bad" && (
                      <TriangleAlert aria-hidden="true" className="size-3 shrink-0" />
                    )}
                    {compare.text}
                  </p>
                )}
              </div>
              <p
                className={cn(
                  "text-right font-sans text-xl font-semibold tracking-tight tabular-nums md:col-start-3 md:row-start-1 md:text-2xl",
                  status === "unusual-bad" && "text-destructive",
                  value === "—" && "text-muted-foreground",
                )}
              >
                {value}
              </p>
              {trend && values.length > 1 && (
                <div className="col-start-2 w-20 md:col-start-2 md:row-start-1 md:w-full">
                  <ReportSparkline
                    points={sparkPoints(reading, weeks, offset)}
                    band={reading.signal.band}
                    label={summary}
                    className="h-8 md:h-10"
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {notes.length > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          Traits en pointillés :{" "}
          {notes.map((item, i) => (
            <span key={item.label}>
              {i > 0 && " · "}
              <span className="text-foreground">{item.label}</span>,{" "}
              {item.note?.toLowerCase()}
            </span>
          ))}
        </p>
      )}
      {(trend || moreHref) && (
        <div className="mt-3 flex flex-col items-start gap-2">
          {trend ? (
            <details className="group w-full">
              <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-md text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
                <ChevronDown
                  aria-hidden="true"
                  className="size-3.5 transition-transform group-open:rotate-180"
                />
                Valeurs semaine par semaine
              </summary>
              <div
                role="region"
                aria-label={`Valeurs des ${readings[0].series.length} dernières semaines`}
                tabIndex={0}
                className="mt-3 overflow-x-auto rounded-xl border outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <table className="w-full min-w-[40rem] text-sm">
                  <caption className="sr-only">
                    Valeur de chaque indicateur, semaine par semaine
                  </caption>
                  <thead className="text-xs text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-3 py-2 text-left font-normal">
                        Semaine du
                      </th>
                      {readings.map((r) => (
                        <th
                          key={r.definition.key}
                          scope="col"
                          className="px-3 py-2 text-right font-normal"
                        >
                          {r.definition.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {readings[0].series.map((point, i, series) => {
                      // La dernière ligne est la semaine du rapport affiché.
                      const shown = i === series.length - 1;
                      return (
                        <tr
                          key={point.weekStart.toISOString()}
                          aria-current={shown ? "true" : undefined}
                          className={cn("border-t", shown && "bg-muted font-medium")}
                        >
                          <th
                            scope="row"
                            className={cn(
                              "px-3 py-1.5 text-left font-normal whitespace-nowrap",
                              shown ? "font-medium text-foreground" : "text-muted-foreground",
                            )}
                          >
                            {day.format(point.weekStart)}
                            {shown && <span className="sr-only"> (semaine affichée)</span>}
                          </th>
                          {readings.map((r) => {
                            const cell = r.series[i];
                            const flagged =
                              cell.status === "unusual-bad" || cell.status === "unusual-good";
                            return (
                              <td
                                key={r.definition.key}
                                className={cn(
                                  "px-3 py-1.5 text-right",
                                  cell.status === "unusual-bad" && "text-destructive",
                                )}
                              >
                                {cell.value === null
                                  ? "—"
                                  : formatValue(r.definition.kind, cell.value)}
                                {flagged && <span className="sr-only"> (inhabituel)</span>}
                                {flagged && <span aria-hidden="true"> •</span>}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                • inhabituel par rapport aux {BASELINE_WEEKS} semaines qui précèdent.
              </p>
            </details>
          ) : null}
          {moreHref && (
            <Button asChild variant="link" size="sm" className="h-auto px-0 text-muted-foreground hover:text-foreground">
              <Link href={moreHref}>
                Statistiques détaillées <ArrowUpRight data-icon="inline-end" />
              </Link>
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

/** Utilité de chaque indicateur, affichée au survol ou au focus de l’icône. */
const purpose: Record<IndicatorKey, string> = {
  autonomy:
    "Votre indicateur principal : la part des conversations que l’IA a menées seule jusqu’au bout. S’il baisse, les actions ci-dessus disent pourquoi.",
  handover:
    "Combien de conversations votre équipe a dû reprendre. Une hausse signale souvent des consignes à préciser.",
  gaps: "Les questions auxquelles l’IA n’a pas su répondre. Ajoutez ces réponses à la base pour qu’elle devienne autonome.",
  aiReply:
    "Le temps d’attente du client avant sa première réponse. Une hausse peut signaler un service ralenti.",
  csat: "La note donnée par vos clients après l’échange : la seule mesure directe de leur ressenti.",
  failures:
    "Les envois et réponses IA qui ont échoué. Une hausse soudaine signale souvent une déconnexion WhatsApp.",
};

/** Ce que recouvre chaque couleur de la barre des conversations. */
const outcomeMeaning: Record<string, string> = {
  autonomous:
    "L’IA a répondu seule : aucune reprise par l’équipe, aucune question restée sans réponse, aucun échec.",
  handover: "Un membre de l’équipe a répondu ou a mis l’IA en pause.",
  gap: "L’IA a répondu en signalant une information qu’elle n’avait pas.",
  unanswered:
    "Le client n’a reçu aucune réponse avant la clôture de la semaine.",
  failed: "Un envoi ou la génération d’une réponse par l’IA a échoué.",
};

/** Chiffre clé d’un bloc : grand nombre et ce qu’il compte, sur une ligne. */
function Headline({ value, unit }: { value: number; unit: string }) {
  return (
    <p className="flex flex-wrap items-baseline gap-x-2">
      <span className="font-sans text-3xl font-semibold tracking-tight tabular-nums">
        {integer.format(value)}
      </span>
      <span className="text-sm text-muted-foreground">{unit}</span>
    </p>
  );
}

export function WeekDetail({
  week,
  base,
  closeLabel,
}: {
  week: WeekAggregate;
  base: string;
  /** Clôture de la semaine, dans le fuseau de l’utilisateur. */
  closeLabel: string;
}) {
  const n = week.conversations;
  const rows = [
    {
      key: "autonomous",
      label: "Menées seules par l’IA",
      count: week.outcome.autonomous,
      className: "bg-foreground",
    },
    {
      key: "handover",
      label: "Reprises par l’équipe",
      count: week.outcome.handover,
      className: "bg-muted-foreground",
    },
    {
      key: "gap",
      label: "Question sans réponse",
      count: week.outcome.gap,
      className: "bg-muted-foreground/60",
    },
    {
      key: "unanswered",
      label: "Sans aucune réponse",
      count: week.outcome.unanswered,
      className: "bg-muted-foreground/35",
    },
    {
      key: "failed",
      label: "Échec technique",
      count: week.outcome.failed,
      className: "bg-destructive",
    },
  ];
  const maxTopic = Math.max(1, ...week.gapTopics.map((topic) => topic.count));
  return (
    <section aria-labelledby="detail-title" className="space-y-10 sm:space-y-12">
      <div>
        <SectionHeader
          id="detail-title"
          title="Conversations de la semaine"
          meta={n ? "Chacune comptée une fois, selon son issue" : undefined}
        />
        <div className="rounded-2xl border p-4 sm:p-5">
          <Headline value={n} unit={n > 1 ? "conversations" : "conversation"} />
          {n ? (
            <>
              <div
                role="group"
                aria-label="Répartition des conversations de la semaine"
                className="mt-4 flex h-6 items-center gap-0.5"
              >
                {rows
                  .filter((row) => row.count > 0)
                  .map((row, index, visible) => (
                    <Tooltip key={row.key}>
                      <TooltipTrigger asChild>
                        {/* La zone survolable déborde du trait pour rester facile à viser. */}
                        <span
                          role="img"
                          tabIndex={0}
                          aria-label={`${row.label} : ${row.count} (${percent.format(row.count / n)})`}
                          className="group/segment flex h-full cursor-default items-center rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                          style={{ width: `${(row.count / n) * 100}%` }}
                        >
                          <span
                            className={cn(
                              "h-2 w-full transition-[height] group-hover/segment:h-3 group-focus-visible/segment:h-3",
                              row.className,
                              index === 0 && "rounded-l-full",
                              index === visible.length - 1 && "rounded-r-full",
                            )}
                          />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="block max-w-64 leading-relaxed">
                        <span className="block font-medium">
                          {row.label} · {row.count} ({percent.format(row.count / n)})
                        </span>
                        <span className="mt-0.5 block opacity-80">
                          {outcomeMeaning[row.key]}
                        </span>
                      </TooltipContent>
                    </Tooltip>
                  ))}
              </div>
              <dl className="mt-3 divide-y divide-border/60">
                {rows.map((row) => (
                  <div key={row.key} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <dt
                      className={cn(
                        "flex min-w-0 items-center gap-2",
                        !row.count && "text-muted-foreground",
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn("size-2 shrink-0 rounded-[2px]", row.className)}
                      />
                      {row.label}
                    </dt>
                    <dd className="flex shrink-0 items-baseline gap-2 tabular-nums">
                      <span className={cn("font-medium", !row.count && "text-muted-foreground")}>
                        {integer.format(row.count)}
                      </span>
                      <span className="w-10 text-right text-xs text-muted-foreground">
                        {percent.format(row.count / n)}
                      </span>
                    </dd>
                  </div>
                ))}
              </dl>
            </>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              Aucune conversation cette semaine.
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-10 md:grid-cols-2 md:gap-6">
        <div className="flex min-w-0 flex-col">
          <SectionHeader id="waiting-title" title="En attente à la clôture" meta={closeLabel} />
          <div className="flex flex-1 flex-col rounded-2xl border p-4 sm:p-5">
            <Headline
              value={week.waiting.total}
              unit={week.waiting.total > 1 ? "clients sans réponse" : "client sans réponse"}
            />
            <dl className="mt-2 divide-y divide-border/60">
              <Row label="Depuis plus de 24 h" value={integer.format(week.waiting.over24h)} alert={week.waiting.over24h > 0} />
              <Row label="En mode manuel" value={integer.format(week.waiting.manual)} />
            </dl>
            <p className="mt-2 text-xs text-muted-foreground">
              Dernier message client resté plus d’une heure sans réponse ;
              conversations « traitées » exclues.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-4 self-start">
              <Link href={`${base}/chat?filter=manual`}>
                Ouvrir la messagerie <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          </div>
        </div>
        <div className="flex min-w-0 flex-col">
          <SectionHeader id="gaps-title" title="Questions sans réponse" meta="Regroupées par thème" />
          <div className="flex flex-1 flex-col rounded-2xl border p-4 sm:p-5">
            <Headline
              value={week.gapsNew}
              unit={week.gapsNew > 1 ? "nouvelles questions" : "nouvelle question"}
            />
            <dl className="mt-2 divide-y divide-border/60">
              <Row label="Encore ouvertes à la clôture" value={integer.format(week.gapsOpenAtClose)} />
            </dl>
            {week.gapTopics.length > 0 && (
              <ul className="mt-3 space-y-2.5" aria-label="Thèmes les plus fréquents">
                {week.gapTopics.map((topic) => (
                  <li
                    key={topic.label}
                    className="grid grid-cols-[minmax(0,6.5rem)_1fr_1.5rem] items-center gap-3 text-sm"
                  >
                    <span className="truncate">{topic.label}</span>
                    <span aria-hidden="true" className="h-1 rounded-full bg-muted">
                      <span
                        className="block h-full rounded-full bg-foreground"
                        style={{ width: `${(topic.count / maxTopic) * 100}%` }}
                      />
                    </span>
                    <span className="text-right tabular-nums text-muted-foreground">
                      {topic.count}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              Le texte des questions reste dans l’application.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-4 self-start">
              <Link href={`${base}/knowledge?tab=improve`}>
                Traiter les questions <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

const legacyKeys = Object.keys(reportMetricLabels) as (keyof ReportMetrics)[];

/** Les 8 compteurs d’activité, en écart absolu (aucun pourcentage). */
export function LegacyCounters({
  current,
  previous,
}: {
  /** Absent d’un ancien rapport : « non mesuré », jamais 0. */
  current: { [K in keyof ReportMetrics]?: number };
  previous: { [K in keyof ReportMetrics]?: number } | null;
}) {
  return (
    <section aria-labelledby="counters-title">
      <SectionHeader
        id="counters-title"
        title="Activité"
        meta={previous ? "En gris : la semaine précédente" : undefined}
      />
      <dl className="grid grid-cols-1 gap-x-8 rounded-2xl border px-4 sm:px-5 md:grid-cols-2">
        {legacyKeys.map((key) => (
          <div
            key={key}
            className="flex items-baseline justify-between gap-3 border-b border-border/60 py-2.5 text-sm last:border-0 md:[&:nth-last-child(2)]:border-0"
          >
            <dt className="min-w-0 text-muted-foreground">{reportMetricLabels[key]}</dt>
            <dd className="shrink-0 tabular-nums">
              {current[key] === undefined ? (
                <span className="text-xs text-muted-foreground">Non mesuré</span>
              ) : (
                <span className="font-medium">{integer.format(current[key])}</span>
              )}
              {previous && previous[key] !== undefined && (
                <span className="ml-2 inline-block min-w-8 text-right text-xs text-muted-foreground">
                  <span className="sr-only">semaine précédente : </span>
                  {integer.format(previous[key] ?? 0)}
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** Ligne d’historique : seulement ce que la liste affiche. */
export type ReportListItem = {
  id: string;
  label: string;
  range: string;
  skipped: boolean;
  emails: { state: string }[];
  verdict: Pick<Verdict, "tone" | "label"> | null;
};

const emailStates: Record<string, string> = {
  PENDING: "en attente",
  SENDING: "en cours",
  SENT: "envoyé",
  CANCELLED: "annulé",
  REVIEW_REQUIRED: "à vérifier",
};

export function HistoryList({
  reports,
  selectedId,
  hrefFor,
}: {
  reports: ReportListItem[];
  selectedId: string;
  hrefFor: (id: string) => string;
}) {
  return (
    <section aria-labelledby="history-title">
      <SectionHeader
        id="history-title"
        title="Rapports précédents"
        meta="Chaque rapport est figé au moment du calcul"
      />
      {/* Hauteur : 8 semaines et un aperçu de la 9e, pour signaler qu’il reste à défiler. */}
      <ScrollFadeArea
        label="Historique des rapports"
        surface="background"
        className="rounded-2xl border"
        viewportClassName="max-h-[33.5rem] sm:max-h-[24rem]"
      >
        <ol className="divide-y p-1">
          {reports.map((report) => {
            const current = report.id === selectedId;
            const sent = report.emails.filter((e) => e.state === "SENT").length;
            const other = report.emails.find((e) => e.state !== "SENT");
            const watch = report.verdict?.tone === "watch";
            const status = report.skipped
              ? "Sans activité · e-mail non envoyé"
              : (report.verdict?.label ?? "Ancien format");
            return (
              <li key={report.id}>
                <Link
                  href={hrefFor(report.id)}
                  aria-current={current ? "page" : undefined}
                  className={cn(
                    "grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-3 py-2.5 text-sm outline-none transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50",
                    current && "bg-muted/60",
                  )}
                >
                  <span
                    className={cn(
                      "font-mono text-xs",
                      current ? "font-medium text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {report.label}
                  </span>
                  <span className="min-w-0">
                    <span className={cn("block", current && "font-medium")}>
                      {report.range}
                    </span>
                    <span
                      className={cn(
                        "mt-0.5 flex items-baseline gap-1.5 text-xs",
                        watch ? "text-destructive" : "text-muted-foreground",
                      )}
                    >
                      <span className="self-center">
                        <Dot tone={watch ? "bad" : "neutral"} />
                      </span>
                      <span className="min-w-0">
                        {status}
                        {!report.skipped && (
                          <span className="hidden md:inline">
                            {" "}· {sent} {emailStates.SENT}
                            {sent > 1 ? "s" : ""}
                            {other ? ` · 1 ${emailStates[other.state]}` : ""}
                          </span>
                        )}
                      </span>
                    </span>
                  </span>
                  {current ? (
                    // La ligne affichée est déjà surlignée : le mot n’apparaît qu’à partir du format tablette.
                    <span className="text-xs text-foreground max-sm:sr-only">Affiché</span>
                  ) : (
                    <ChevronRight aria-hidden="true" className="size-4 text-muted-foreground" />
                  )}
                </Link>
              </li>
            );
          })}
        </ol>
      </ScrollFadeArea>
    </section>
  );
}

const definitions: Record<
  IndicatorKey,
  { computed: string; notProven: string }
> = {
  autonomy: {
    computed:
      "Conversations où l’IA a répondu sans reprise par l’équipe, sans question restée sans réponse et sans échec technique, divisées par les conversations ayant demandé une réponse. Diffusions, accusés de réception (« merci ») et réponses au questionnaire exclus.",
    notProven:
      "Que les réponses étaient justes ni que le client est satisfait. Une conversation courte compte autant qu’une longue.",
  },
  handover: {
    computed:
      "Conversations où un membre de l’équipe a répondu (application ou téléphone) ou a mis l’IA en pause pendant la semaine. Les diffusions ne comptent pas.",
    notProven:
      "Qu’il y a eu un problème : une reprise peut être voulue (vente, réclamation, client connu).",
  },
  gaps: {
    computed:
      "Questions que l’IA a signalées comme hors de ses connaissances, apparues pendant la semaine.",
    notProven:
      "Les questions mal comprises que l’IA n’a pas signalées n’y figurent pas.",
  },
  aiReply: {
    computed:
      "Délai entre le premier message client de la semaine et la première réponse envoyée, par conversation. Médiane, et délai sous lequel 9 clients sur 10 sont servis. L’équipe est mesurée à part.",
    notProven:
      "Nuits et week-ends comptent : aucun horaire d’ouverture n’est connu.",
  },
  csat: {
    computed:
      "Moyenne des notes de 1 à 5 reçues avant la fin de la semaine, pour les questionnaires envoyés pendant la semaine, et taux de réponse.",
    notProven:
      "Les clients qui répondent ne représentent pas forcément les autres.",
  },
  failures: {
    computed:
      "Messages sortants en échec et réponses IA non générées, hors annulations normales (message regroupé, conversation reprise).",
    notProven:
      "Ne retrace pas les déconnexions WhatsApp elles-mêmes, seulement leurs effets.",
  },
};

export function Definitions({
  readings,
  method,
}: {
  readings: IndicatorReading[];
  /** Méthode de comparaison, repliée avec les définitions. */
  method?: ReactNode;
}) {
  return (
    <section aria-labelledby="definitions-title">
      <SectionHeader id="definitions-title" title="Comprendre ce rapport" />
      <Accordion type="multiple" className="w-full rounded-2xl border px-4 sm:px-5">
        {readings.map(({ definition }) => (
          <AccordionItem key={definition.key} value={definition.key}>
            <AccordionTrigger className="text-left text-sm font-normal">
              {definition.label}
            </AccordionTrigger>
            <AccordionContent className="space-y-2 text-sm text-muted-foreground">
              <p>{definition.question}</p>
              <p>
                <span className="text-foreground">Calcul. </span>
                {definitions[definition.key].computed}
              </p>
              <p>
                <span className="text-foreground">Ne prouve pas. </span>
                {definitions[definition.key].notProven}
              </p>
              <p>
                <span className="text-foreground">Seuil. </span>
                {definition.kind === "count"
                  ? `Comparé à partir de ${definition.minSample} événements ; en dessous, écart absolu.`
                  : `Comparé à partir de ${definition.minSample} ${definition.key === "csat" ? "réponses" : "conversations"} dans la semaine.`}
              </p>
            </AccordionContent>
          </AccordionItem>
        ))}
        {method && (
          <AccordionItem value="method">
            <AccordionTrigger className="text-left text-sm font-normal">
              Méthode de comparaison
            </AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground">
              {method}
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>
    </section>
  );
}
