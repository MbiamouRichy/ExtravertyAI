import Link from "next/link";
import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  TriangleAlert,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { reportMetricLabels, type ReportMetrics } from "@/lib/weekly-report";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

import type { WeekAggregate } from "./data";
import {
  confidenceLabel,
  formatBand,
  formatDuration,
  formatValue,
  type Finding,
  type Verdict,
} from "./findings";
import type { IndicatorKey, IndicatorReading } from "./indicators";
import { isoWeek, weekNote, type PreviewReport } from "./scenario";
import { wilson, type SignalStatus } from "./signal";
import { ReportSparkline, type SparkPoint } from "./sparkline";

const percent = new Intl.NumberFormat("fr-FR", {
  style: "percent",
  maximumFractionDigits: 0,
});
const integer = new Intl.NumberFormat("fr-FR");

/** Titre de section discret : la hiérarchie vient de l'espace, pas des cadres. */
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
    <div className="mb-4 flex items-baseline justify-between gap-4">
      <h2 id={id} className="font-sans text-sm font-medium tracking-normal">
        {title}
      </h2>
      {meta && (
        <p className="text-right text-xs text-muted-foreground">{meta}</p>
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

export function VerdictPanel({
  verdict,
  partial,
}: {
  verdict: Verdict;
  partial: boolean;
}) {
  const watch = verdict.tone === "watch";
  return (
    <section aria-labelledby="verdict-title">
      <p
        className={cn(
          "flex items-center gap-2 text-sm",
          watch ? "font-medium text-destructive" : "text-muted-foreground",
        )}
      >
        <Dot
          tone={watch ? "bad" : verdict.tone === "good" ? "good" : "neutral"}
        />
        {verdict.label}
      </p>
      <h2
        id="verdict-title"
        className="mt-3 max-w-4xl font-sans text-2xl leading-tight font-medium tracking-tight text-balance sm:text-[2rem]"
      >
        {verdict.sentence}
      </h2>
      {partial && (
        <p className="mt-4 text-sm text-muted-foreground">
          Projet récent : la première semaine a commencé après sa création, ses
          volumes sont incomplets.
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
        <ol className="divide-y border-y">
          {findings.map((finding, index) => (
            <li
              key={finding.id}
              className="grid gap-4 py-5 sm:grid-cols-[2.5rem_1fr_auto] sm:items-start"
            >
              <span
                aria-hidden="true"
                className="hidden pt-0.5 font-mono text-xs text-muted-foreground sm:block"
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0">
                <h3 className="font-sans text-base font-medium tracking-normal">
                  {finding.title}
                </h3>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {finding.evidence.join(" · ")}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {confidenceLabel[finding.confidence]} · ≈{" "}
                  {integer.format(Math.round(finding.impact))} conversation
                  {Math.round(finding.impact) > 1 ? "s" : ""} concernée
                  {Math.round(finding.impact) > 1 ? "s" : ""}
                </p>
              </div>
              <Button
                asChild
                size="sm"
                variant={index === 0 ? "default" : "outline"}
                className="justify-self-start"
              >
                <Link href={finding.action.href}>
                  {finding.action.label}
                  <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
            </li>
          ))}
        </ol>
      ) : (
        <p className="border-y py-5 text-sm text-muted-foreground">
          Rien d’urgent. Relisez deux ou trois conversations menées par l’IA et
          précisez une consigne.
        </p>
      )}
    </section>
  );
}

const statusText: Partial<Record<SignalStatus, string>> = {
  "low-sample": "Effectif faible",
  "insufficient-history": "Historique court",
  "not-measured": "Non mesuré à l’époque",
};

const statusSentence: Record<SignalStatus, string> = {
  "unusual-bad": "hors de la plage normale, dans le mauvais sens",
  "unusual-good": "hors de la plage normale, dans le bon sens",
  usual: "dans la plage normale",
  "low-sample": "effectif trop faible pour comparer",
  "insufficient-history": "historique insuffisant pour comparer",
  "not-measured": "non mesuré à l’époque",
};

function ci(successes: number, n: number) {
  const { low, high } = wilson(successes, n);
  return `IC 95 % ${percent.format(low)}–${percent.format(high)}`;
}

function tileDetail(key: IndicatorKey, week: WeekAggregate) {
  const { outcome, conversations: n } = week;
  switch (key) {
    case "autonomy":
      return n
        ? `${outcome.autonomous} sur ${n} · ${ci(outcome.autonomous, n)}`
        : "Aucune conversation";
    case "handover":
      return n
        ? `${outcome.handover} sur ${n} · ${ci(outcome.handover, n)}`
        : "Aucune conversation";
    case "gaps":
      return `${integer.format(week.gapsOpenAtClose)} encore ouvertes à la clôture`;
    case "aiReply":
      return week.aiReply.n
        ? `9 sur 10 en moins de ${formatDuration(week.aiReply.p90)} · équipe : ${week.teamReply.n ? formatDuration(week.teamReply.median) : "—"}`
        : "Aucune réponse de l’IA";
    case "csat":
      return `${week.csat.responses} réponses sur ${week.csat.sent} questionnaires`;
    case "failures":
      return `${week.sends.failed} envois · ${week.aiJobsFailed} réponses IA`;
  }
}

function habitLine(reading: IndicatorReading) {
  const { status, band } = reading.signal;
  const { kind, minSample } = reading.definition;
  if (status === "insufficient-history")
    return "Pas encore de plage normale (moins de 4 semaines)";
  if (status === "low-sample") {
    if (
      kind === "count" &&
      reading.previous?.value != null &&
      reading.current.value != null
    )
      return `${formatValue(kind, reading.previous.value)} → ${formatValue(kind, reading.current.value)} vs semaine précédente`;
    return `n = ${reading.current.n}, sous le seuil de ${minSample}`;
  }
  if (!band) return "";
  const median = kind === "count" ? Math.round(band.median) : band.median;
  return `Habitude ${formatValue(kind, median)} · plage ${formatBand(kind, band)}`;
}

function sparkPoints(
  reading: IndicatorReading,
  weeks: WeekAggregate[],
  offset: number,
): SparkPoint[] {
  const day = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  return reading.series.map((point, i) => ({
    label: `S${isoWeek(point.weekStart)}`,
    range: `sem. du ${day.format(point.weekStart)}`,
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

export function IndicatorGrid({
  readings,
  weeks,
  index,
  legacy = false,
}: {
  readings: IndicatorReading[];
  weeks: WeekAggregate[];
  index: number;
  /** Ancien instantané (v1) : ces indicateurs n'y figurent pas, rien n'est affiché à 0. */
  legacy?: boolean;
}) {
  const week = weeks[index];
  const offset = index - readings[0].series.length + 1;
  const notes = legacy
    ? []
    : readings[0].series
        .map((point, i) => ({
          label: `S${isoWeek(point.weekStart)}`,
          note: weekNote(weeks[offset + i]),
        }))
        .filter((item) => item.note);

  return (
    <section aria-labelledby="indicators-title">
      <SectionHeader
        id="indicators-title"
        title="Indicateurs"
        meta="12 semaines · bande grisée = plage normale des 8 semaines précédentes"
      />
      <ul className="grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2 lg:grid-cols-3">
        {readings.map((reading) => {
          const { definition, current } = reading;
          const status: SignalStatus = legacy
            ? "not-measured"
            : reading.signal.status;
          const unusual = status === "unusual-bad" || status === "unusual-good";
          const values = reading.series.flatMap((p) =>
            p.value === null ? [] : [p.value],
          );
          const value =
            current.value === null || legacy
              ? "—"
              : formatValue(definition.kind, current.value);
          const summary = values.length
            ? `${definition.label}, 12 dernières semaines : entre ${formatValue(definition.kind, Math.min(...values))} et ${formatValue(definition.kind, Math.max(...values))}. Cette semaine : ${value}, ${statusSentence[status]}.`
            : `${definition.label} : aucune valeur sur la période.`;
          return (
            <li
              key={definition.key}
              className="flex flex-col bg-background p-5"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-sans text-sm font-normal tracking-normal text-muted-foreground">
                  {definition.label}
                </h3>
                {unusual ? (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 text-xs font-medium",
                      status === "unusual-bad"
                        ? "text-destructive"
                        : "text-foreground",
                    )}
                  >
                    {status === "unusual-bad" && (
                      <TriangleAlert aria-hidden="true" className="size-3" />
                    )}
                    {status === "unusual-bad"
                      ? "Inhabituel"
                      : "Mieux que d’habitude"}
                  </span>
                ) : (
                  statusText[status] && (
                    <span className="text-xs text-muted-foreground">
                      {statusText[status]}
                    </span>
                  )
                )}
              </div>
              <p
                className={cn(
                  "mt-2 font-sans text-3xl font-semibold tracking-tight",
                  status === "unusual-bad" && "text-destructive",
                  legacy && "text-muted-foreground",
                )}
              >
                {value}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {legacy
                  ? "Indicateur absent de ce rapport"
                  : habitLine(reading)}
              </p>
              <div className="mt-auto pt-4">
                {legacy ? (
                  <div
                    aria-hidden="true"
                    className="h-12 border-b border-dashed"
                  />
                ) : (
                  <ReportSparkline
                    points={sparkPoints(reading, weeks, offset)}
                    band={reading.signal.band}
                    label={summary}
                  />
                )}
              </div>
              {!legacy && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {tileDetail(definition.key, week)}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      {notes.length > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          Repères en pointillés :{" "}
          {notes.map((item, i) => (
            <span key={item.label}>
              {i > 0 && " · "}
              <span className="text-foreground">{item.label}</span>{" "}
              {item.note?.toLowerCase()}
            </span>
          ))}
        </p>
      )}
      {!legacy && (
        <details className="group mt-3">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-md text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
            <ChevronDown
              aria-hidden="true"
              className="size-3.5 transition-transform group-open:rotate-180"
            />
            Afficher les valeurs en tableau
          </summary>
          <div
            role="region"
            aria-label="Valeurs des 12 semaines"
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
                    Semaine
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
                {readings[0].series.map((point, i) => (
                  <tr key={point.weekStart.toISOString()} className="border-t">
                    <th
                      scope="row"
                      className="px-3 py-1.5 text-left font-normal text-muted-foreground"
                    >
                      S{isoWeek(point.weekStart)}
                    </th>
                    {readings.map((r) => {
                      const cell = r.series[i];
                      const flagged =
                        cell.status === "unusual-bad" ||
                        cell.status === "unusual-good";
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
                          {flagged && (
                            <span className="sr-only"> (inhabituel)</span>
                          )}
                          {flagged && <span aria-hidden="true"> •</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            • inhabituel par rapport aux 8 semaines qui précèdent.
          </p>
        </details>
      )}
    </section>
  );
}

export function WeekDetail({
  week,
  base,
}: {
  week: WeekAggregate;
  base: string;
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
    <section aria-labelledby="detail-title" className="space-y-10">
      <div>
        <SectionHeader
          id="detail-title"
          title={`Les ${n} conversations de la semaine`}
          meta="Chacune comptée une fois"
        />
        {n ? (
          <>
            <div
              aria-hidden="true"
              className="flex h-2 gap-0.5 overflow-hidden rounded-full"
            >
              {rows
                .filter((row) => row.count > 0)
                .map((row) => (
                  <span
                    key={row.key}
                    className={row.className}
                    style={{ width: `${(row.count / n) * 100}%` }}
                  />
                ))}
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-5">
              {rows.map((row) => (
                <div key={row.key}>
                  <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span
                      aria-hidden="true"
                      className={cn("size-2 rounded-[2px]", row.className)}
                    />
                    {row.label}
                  </dt>
                  <dd className="mt-1 text-lg font-semibold tracking-tight">
                    {row.count}
                    <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                      {percent.format(row.count / n)}
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Aucune conversation cette semaine.
          </p>
        )}
      </div>

      <div className="grid gap-10 md:grid-cols-2">
        <div>
          <SectionHeader
            id="gaps-title"
            title="Questions sans réponse"
            meta={`${week.gapsNew} nouvelles · ${week.gapsOpenAtClose} ouvertes`}
          />
          {week.gapTopics.length ? (
            <ul className="space-y-2.5">
              {week.gapTopics.map((topic) => (
                <li
                  key={topic.label}
                  className="grid grid-cols-[6.5rem_1fr_1.5rem] items-center gap-3 text-sm"
                >
                  <span className="truncate">{topic.label}</span>
                  <span
                    aria-hidden="true"
                    className="h-1 rounded-full bg-muted"
                  >
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
          ) : (
            <p className="text-sm text-muted-foreground">
              Aucune nouvelle question.
            </p>
          )}
          <p className="mt-4 text-xs text-muted-foreground">
            Regroupées par thème ; le texte des questions reste dans
            l’application.
          </p>
          <Button asChild variant="outline" size="sm" className="mt-4">
            <Link href={`${base}/knowledge?tab=improve`}>
              Traiter les questions <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        </div>
        <div>
          <SectionHeader
            id="waiting-title"
            title="En attente à la clôture"
            meta="Dimanche minuit, UTC"
          />
          <dl className="grid grid-cols-3 divide-x rounded-xl border">
            {(
              [
                ["Clients", week.waiting.total],
                ["Plus de 24 h", week.waiting.over24h],
                ["Mode manuel", week.waiting.manual],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="p-4">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="mt-1 text-2xl font-semibold tracking-tight">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-xs text-muted-foreground">
            Dernier message client sans réponse depuis plus d’une heure ;
            conversations « traitées » exclues.
          </p>
          <Button asChild variant="outline" size="sm" className="mt-4">
            <Link href={`${base}/chat?filter=manual`}>
              Ouvrir la messagerie <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

const legacyKeys = Object.keys(reportMetricLabels) as (keyof ReportMetrics)[];

/** Les 8 compteurs de l'ancien format, en écart absolu (aucun pourcentage). */
export function LegacyCounters({
  current,
  previous,
}: {
  current: WeekAggregate["legacy"];
  previous: WeekAggregate["legacy"] | null;
}) {
  return (
    <section aria-labelledby="counters-title">
      <SectionHeader
        id="counters-title"
        title="Compteurs d’activité"
        meta="Semaine précédente → cette semaine"
      />
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-4">
        {legacyKeys.map((key) => (
          <div key={key} className="bg-background p-4">
            <dt className="text-xs text-muted-foreground">
              {reportMetricLabels[key]}
            </dt>
            <dd className="mt-1 text-lg font-semibold tracking-tight">
              {integer.format(current[key])}
              {previous && (
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                  avant {integer.format(previous[key])}
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

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
  reports: PreviewReport[];
  selectedId: string;
  hrefFor: (id: string) => string;
}) {
  return (
    <section aria-labelledby="history-title">
      <SectionHeader
        id="history-title"
        title="Historique"
        meta="12 dernières semaines, figées au calcul"
      />
      <ol className="divide-y border-y">
        {reports.map((report) => {
          const current = report.id === selectedId;
          const sent = report.emails.filter((e) => e.state === "SENT").length;
          const other = report.emails.find((e) => e.state !== "SENT");
          const status = report.skipped
            ? "Sans activité · e-mail non envoyé"
            : (report.verdict?.label ?? "Ancien format");
          return (
            <li key={report.id}>
              <Link
                href={hrefFor(report.id)}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "-mx-2 grid grid-cols-[3rem_1fr_auto] items-center gap-3 rounded-lg px-2 py-3 text-sm outline-none transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 sm:grid-cols-[3rem_1fr_12rem_auto]",
                  current && "bg-muted/60",
                )}
              >
                <span
                  className={cn(
                    "font-mono text-xs",
                    current ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {report.label}
                </span>
                <span className="min-w-0">
                  <span
                    className={cn("block truncate", current && "font-medium")}
                  >
                    {report.range}
                  </span>
                  <span
                    className={cn(
                      "mt-0.5 flex items-center gap-1.5 text-xs sm:hidden",
                      report.verdict?.tone === "watch"
                        ? "text-destructive"
                        : "text-muted-foreground",
                    )}
                  >
                    {status}
                  </span>
                </span>
                <span
                  className={cn(
                    "hidden items-center gap-1.5 text-xs sm:flex",
                    report.verdict?.tone === "watch"
                      ? "text-destructive"
                      : "text-muted-foreground",
                  )}
                >
                  <Dot
                    tone={report.verdict?.tone === "watch" ? "bad" : "neutral"}
                  />
                  {status}
                </span>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="hidden md:inline">
                    {report.skipped
                      ? ""
                      : `${sent} ${emailStates.SENT}${other ? ` · 1 ${emailStates[other.state]}` : ""}`}
                  </span>
                  {current ? (
                    <span className="text-foreground">Affiché</span>
                  ) : (
                    <ChevronRight aria-hidden="true" className="size-4" />
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
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

export function Definitions({ readings }: { readings: IndicatorReading[] }) {
  return (
    <section aria-labelledby="definitions-title">
      <SectionHeader
        id="definitions-title"
        title="Comprendre les indicateurs"
      />
      <Accordion type="multiple" className="w-full border-t">
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
      </Accordion>
    </section>
  );
}
