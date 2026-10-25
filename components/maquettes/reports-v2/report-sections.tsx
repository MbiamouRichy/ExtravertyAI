import Link from "next/link";
import {
  ArrowRight,
  Check,
  ChevronRight,
  CircleCheck,
  CircleDashed,
  CircleSlash,
  Clock,
  Minus,
  Sprout,
  Table2,
  TrendingUp,
  TriangleAlert,
  type LucideIcon,
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

const verdictTone: Record<
  Verdict["tone"],
  { icon: LucideIcon; className: string }
> = {
  watch: {
    icon: TriangleAlert,
    className: "border-destructive/40 text-destructive",
  },
  good: { icon: TrendingUp, className: "border-foreground/30" },
  usual: { icon: CircleCheck, className: "text-muted-foreground" },
  new: { icon: Sprout, className: "text-muted-foreground" },
  empty: {
    icon: CircleSlash,
    className: "border-dashed text-muted-foreground",
  },
};

export function VerdictPanel({
  verdict,
  report,
  partial,
}: {
  verdict: Verdict;
  report: PreviewReport;
  partial: boolean;
}) {
  const tone = verdictTone[verdict.tone];
  return (
    <section
      aria-labelledby="verdict-title"
      className={cn(
        "rounded-2xl border bg-card p-5 sm:p-7",
        verdict.tone === "watch" && "border-destructive/30",
      )}
    >
      <h2 id="verdict-title" className="sr-only">
        Verdict de la semaine
      </h2>
      <p
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
          tone.className,
        )}
      >
        <tone.icon aria-hidden="true" className="size-3.5" />
        {verdict.label}
      </p>
      <p className="mt-4 max-w-3xl font-heading text-xl leading-snug font-semibold text-balance sm:text-2xl">
        {verdict.sentence}
      </p>
      <p className="mt-3 text-sm text-muted-foreground">
        {report.label} · {report.range} (heures UTC) · comparée aux 8 semaines
        précédentes
      </p>
      {partial && (
        <p className="mt-4 rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
          Projet récent : la première semaine a commencé après la création du
          projet. Les volumes de cette semaine-là sont incomplets.
        </p>
      )}
    </section>
  );
}

export function FindingsList({ findings }: { findings: Finding[] }) {
  return (
    <section aria-labelledby="findings-title">
      <h2 id="findings-title" className="text-2xl tracking-tight">
        Ce qui demande votre attention
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Trois constats au plus, classés par nombre de conversations concernées
        et solidité de la preuve.
      </p>
      {findings.length ? (
        <ol className="mt-5 space-y-3">
          {findings.map((finding, index) => (
            <li key={finding.id} className="rounded-2xl border bg-card p-5">
              <div className="flex gap-4">
                <span
                  aria-hidden="true"
                  className="flex size-7 shrink-0 items-center justify-center rounded-full border font-mono text-xs"
                >
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-sans text-base font-medium tracking-normal">
                    {finding.title}
                  </h3>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {finding.evidence.map((line) => (
                      <li key={line} className="flex gap-2">
                        <span
                          aria-hidden="true"
                          className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground"
                        />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5",
                          finding.confidence === "high" &&
                            "border-foreground/30 text-foreground",
                          finding.confidence === "low" && "border-dashed",
                        )}
                      >
                        {confidenceLabel[finding.confidence]}
                      </span>
                      <span>
                        ≈ {integer.format(Math.round(finding.impact))}{" "}
                        conversation
                        {Math.round(finding.impact) > 1 ? "s" : ""} concernée
                        {Math.round(finding.impact) > 1 ? "s" : ""}
                      </span>
                    </p>
                    <Button
                      asChild
                      size="sm"
                      variant={index === 0 ? "default" : "outline"}
                    >
                      <Link href={finding.action.href}>
                        {finding.action.label}
                        <ArrowRight data-icon="inline-end" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-5 rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">
          Rien d’urgent cette semaine. Profitez-en pour relire deux ou trois
          conversations menées par l’IA et préciser une consigne.
        </p>
      )}
    </section>
  );
}

const statusChip: Record<
  SignalStatus,
  { label: string; icon: LucideIcon; className: string }
> = {
  "unusual-bad": {
    label: "Inhabituel",
    icon: TriangleAlert,
    className: "border-destructive/40 text-destructive",
  },
  "unusual-good": {
    label: "Inhabituel, favorable",
    icon: TrendingUp,
    className: "border-foreground/30",
  },
  usual: {
    label: "Dans l’habitude",
    icon: Check,
    className: "text-muted-foreground",
  },
  "low-sample": {
    label: "Effectif faible",
    icon: CircleDashed,
    className: "border-dashed text-muted-foreground",
  },
  "insufficient-history": {
    label: "Historique court",
    icon: Clock,
    className: "text-muted-foreground",
  },
  "not-measured": {
    label: "Non mesuré à l’époque",
    icon: Minus,
    className: "border-dashed text-muted-foreground",
  },
};

const statusSentence: Record<SignalStatus, string> = {
  "unusual-bad": "hors de la plage normale, dans le mauvais sens",
  "unusual-good": "hors de la plage normale, dans le bon sens",
  usual: "dans la plage normale",
  "low-sample": "effectif trop faible pour comparer",
  "insufficient-history": "historique insuffisant pour comparer",
  "not-measured": "non mesuré à l’époque",
};

function StatusChip({ status }: { status: SignalStatus }) {
  const chip = statusChip[status];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        chip.className,
      )}
    >
      <chip.icon aria-hidden="true" className="size-3" />
      {chip.label}
    </span>
  );
}

function ci(successes: number, n: number) {
  const { low, high } = wilson(successes, n);
  return `IC 95 % ${percent.format(low)}–${percent.format(high)}`;
}

function tileDetails(
  key: IndicatorKey,
  week: WeekAggregate,
): { primary: string; secondary?: string } {
  const { outcome, conversations: n, handoverReasons: reasons } = week;
  switch (key) {
    case "autonomy":
      return {
        primary: n
          ? `${outcome.autonomous} sur ${n} conversations · ${ci(outcome.autonomous, n)}`
          : "Aucune conversation",
      };
    case "handover":
      return {
        primary: n
          ? `${outcome.handover} sur ${n} · ${ci(outcome.handover, n)}`
          : "Aucune conversation",
        secondary: `Application ${reasons.app} · téléphone ${reasons.phone} · pause ${reasons.manual} · déjà en pause ${reasons.alreadyPaused}`,
      };
    case "gaps":
      return {
        primary: `${integer.format(week.gapsOpenAtClose)} encore ouvertes à la clôture`,
      };
    case "aiReply":
      return {
        primary: week.aiReply.n
          ? `9 sur 10 en moins de ${formatDuration(week.aiReply.p90)} · ${week.aiReply.n} conversations`
          : "Aucune réponse de l’IA",
        secondary: week.teamReply.n
          ? `Équipe : médiane ${formatDuration(week.teamReply.median)} sur ${week.teamReply.n} réponses${week.teamReply.n < 10 ? " (trop peu pour comparer)" : `, 9 sur 10 en moins de ${formatDuration(week.teamReply.p90)}`}`
          : "Équipe : aucune première réponse",
      };
    case "csat":
      return {
        primary: `${week.csat.responses} réponses sur ${week.csat.sent} questionnaires`,
        secondary: week.csat.sent
          ? `Taux de réponse ${percent.format(week.csat.responses / week.csat.sent)} · ${ci(week.csat.responses, week.csat.sent)}`
          : undefined,
      };
    case "failures":
      return {
        primary: `${week.sends.failed} messages sur ${integer.format(week.sends.attempted)} envois · ${week.aiJobsFailed} réponses IA`,
      };
  }
}

function habitLine(reading: IndicatorReading) {
  const { status, band } = reading.signal;
  const { kind, minSample } = reading.definition;
  if (status === "not-measured")
    return "Cet indicateur n’existait pas lors de ce rapport.";
  if (status === "insufficient-history")
    return "Moins de 4 semaines comparables : pas encore de plage normale.";
  if (status === "low-sample") {
    if (
      kind === "count" &&
      reading.previous?.value != null &&
      reading.current.value != null
    )
      return `Semaine précédente → cette semaine : ${formatValue(kind, reading.previous.value)} → ${formatValue(kind, reading.current.value)}`;
    return `Effectif ${reading.current.n} sous le seuil de ${minSample} : aucune comparaison.`;
  }
  if (!band) return "";
  const median = kind === "count" ? Math.round(band.median) : band.median;
  return `Habitude ${formatValue(kind, median)} · plage normale ${formatBand(kind, band)}`;
}

function sparkPoints(
  reading: IndicatorReading,
  weeks: WeekAggregate[],
  offset: number,
): SparkPoint[] {
  return reading.series.map((point, i) => {
    const week = weeks[offset + i];
    return {
      label: `S${isoWeek(point.weekStart)}`,
      range: `sem. du ${new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" }).format(point.weekStart)}`,
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
      note: weekNote(week),
    };
  });
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
  const notMeasured = legacy;

  return (
    <section aria-labelledby="indicators-title">
      <h2 id="indicators-title" className="text-2xl tracking-tight">
        Six indicateurs, situés dans leur habitude
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        12 semaines par indicateur. La bande grisée est la plage normale des 8
        semaines précédentes ; seule une valeur hors bande est signalée.
      </p>
      <ul className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {readings.map((reading) => {
          const { definition, current } = reading;
          const status: SignalStatus = notMeasured
            ? "not-measured"
            : reading.signal.status;
          const details = tileDetails(definition.key, week);
          const values = reading.series.flatMap((p) =>
            p.value === null ? [] : [p.value],
          );
          const value =
            current.value === null || notMeasured
              ? "—"
              : formatValue(definition.kind, current.value);
          const summary = values.length
            ? `${definition.label}, 12 dernières semaines : entre ${formatValue(definition.kind, Math.min(...values))} et ${formatValue(definition.kind, Math.max(...values))}. Cette semaine : ${value}, ${statusSentence[status]}.`
            : `${definition.label} : aucune valeur sur la période.`;
          return (
            <li
              key={definition.key}
              className={cn(
                "flex flex-col rounded-2xl border bg-card p-4",
                status === "unusual-bad" && "border-destructive/40",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-sans text-sm font-normal tracking-normal text-muted-foreground">
                  {definition.label}
                </h3>
                <StatusChip status={status} />
              </div>
              <p className="mt-2 font-heading text-3xl font-semibold tracking-tight">
                {value}
              </p>
              {!notMeasured && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {details.primary}
                </p>
              )}
              <div className="mt-3">
                {notMeasured ? (
                  <div
                    aria-hidden="true"
                    className="h-16 rounded-lg border border-dashed"
                  />
                ) : (
                  <ReportSparkline
                    points={sparkPoints(reading, weeks, offset)}
                    band={reading.signal.band}
                    label={summary}
                  />
                )}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {notMeasured ? "Non mesuré à l’époque" : habitLine(reading)}
              </p>
              {details.secondary && !notMeasured && (
                <p className="mt-2 border-t pt-2 text-xs text-muted-foreground">
                  {details.secondary}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      {notes.length > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          Repères (traits pointillés) :{" "}
          {notes.map((item, i) => (
            <span key={item.label}>
              {i > 0 && " · "}
              <span className="font-medium text-foreground">
                {item.label}
              </span>{" "}
              {item.note}
            </span>
          ))}
        </p>
      )}
      {!notMeasured && (
        <details className="group mt-4 rounded-xl border bg-card">
          <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
            <Table2 aria-hidden="true" className="size-4" />
            Voir les valeurs des 12 semaines
            <ChevronRight
              aria-hidden="true"
              className="ml-auto size-4 transition-transform group-open:rotate-90"
            />
          </summary>
          <div
            role="region"
            aria-label="Valeurs des 12 semaines"
            tabIndex={0}
            className="overflow-x-auto border-t outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
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
                      className="px-3 py-1.5 text-left font-normal"
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
                            <>
                              <span aria-hidden="true"> ◆</span>
                              <span className="sr-only"> (inhabituel)</span>
                            </>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="border-t px-3 py-2 text-xs text-muted-foreground">
              ◆ valeur inhabituelle par rapport aux 8 semaines qui la précèdent.
            </p>
          </div>
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
    },
    {
      key: "handover",
      label: "Reprises par l’équipe",
      count: week.outcome.handover,
    },
    {
      key: "gap",
      label: "Question restée sans réponse de l’IA",
      count: week.outcome.gap,
    },
    {
      key: "unanswered",
      label: "Restées sans aucune réponse",
      count: week.outcome.unanswered,
    },
    {
      key: "failed",
      label: "Échec d’envoi ou de génération",
      count: week.outcome.failed,
    },
  ];
  const maxTopic = Math.max(1, ...week.gapTopics.map((topic) => topic.count));
  return (
    <section aria-labelledby="detail-title" className="space-y-4">
      <div>
        <h2 id="detail-title" className="text-2xl tracking-tight">
          Où l’IA a passé la main
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Chaque conversation est comptée une fois, dans la première catégorie
          qui la concerne (échec, puis reprise, puis question sans réponse).
        </p>
      </div>
      <div className="rounded-2xl border bg-card p-5">
        <h3 className="font-sans text-sm font-medium tracking-normal">
          Les {n} conversations de la semaine
        </h3>
        {n ? (
          <ul className="mt-4 space-y-3">
            {rows.map((row) => (
              <li key={row.key}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span>{row.label}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {row.count}
                    </span>{" "}
                    · {percent.format(row.count / n)}
                  </span>
                </div>
                <div
                  aria-hidden="true"
                  className="mt-1.5 h-1.5 rounded-full bg-muted"
                >
                  <div
                    className={cn(
                      "h-full rounded-full",
                      row.key === "autonomous"
                        ? "bg-foreground"
                        : "bg-muted-foreground",
                    )}
                    style={{ width: `${(row.count / n) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            Aucune conversation cette semaine.
          </p>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col rounded-2xl border bg-card p-5">
          <h3 className="font-sans text-sm font-medium tracking-normal">
            Questions sans réponse, regroupées
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {week.gapsNew} nouvelles cette semaine · {week.gapsOpenAtClose}{" "}
            ouvertes à la clôture
          </p>
          {week.gapTopics.length ? (
            <ul className="mt-4 space-y-2.5">
              {week.gapTopics.map((topic) => (
                <li
                  key={topic.label}
                  className="grid grid-cols-[7rem_1fr_auto] items-center gap-3 text-sm"
                >
                  <span className="truncate">{topic.label}</span>
                  <span
                    aria-hidden="true"
                    className="h-1.5 rounded-full bg-muted"
                  >
                    <span
                      className="block h-full rounded-full bg-muted-foreground"
                      style={{ width: `${(topic.count / maxTopic) * 100}%` }}
                    />
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {topic.count}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              Aucune nouvelle question cette semaine.
            </p>
          )}
          <p className="mt-4 text-xs text-muted-foreground">
            Regroupement par thème. Le texte des questions reste dans l’onglet «
            À améliorer », jamais dans l’e-mail.
          </p>
          <Button
            asChild
            variant="outline"
            size="sm"
            className="mt-4 self-start"
          >
            <Link href={`${base}/knowledge?tab=improve`}>
              Ouvrir les questions à traiter{" "}
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        </div>
        <div className="flex flex-col rounded-2xl border bg-card p-5">
          <h3 className="font-sans text-sm font-medium tracking-normal">
            En attente à la clôture
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Dimanche minuit (UTC), dernier message client sans réponse depuis
            plus d’une heure
          </p>
          <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
            {[
              ["En attente", week.waiting.total],
              ["Depuis plus de 24 h", week.waiting.over24h],
              ["En mode manuel", week.waiting.manual],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border p-3">
                <dt className="text-[11px] leading-tight text-muted-foreground">
                  {label}
                </dt>
                <dd className="mt-1 font-heading text-2xl font-semibold">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-xs text-muted-foreground">
            Une conversation marquée « traitée » par l’équipe n’est pas comptée.
          </p>
          <Button
            asChild
            variant="outline"
            size="sm"
            className="mt-4 self-start"
          >
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
  open = false,
}: {
  current: WeekAggregate["legacy"];
  previous: WeekAggregate["legacy"] | null;
  open?: boolean;
}) {
  return (
    <details open={open} className="group rounded-2xl border bg-card">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-2xl px-5 py-4 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
        Compteurs d’activité de la semaine
        <span className="font-normal text-muted-foreground">
          · 8 compteurs historiques
        </span>
        <ChevronRight
          aria-hidden="true"
          className="ml-auto size-4 shrink-0 transition-transform group-open:rotate-90"
        />
      </summary>
      <table className="w-full border-t text-sm">
        <caption className="sr-only">
          Compteurs d’activité, semaine précédente et semaine affichée
        </caption>
        <thead className="text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="px-5 py-2 text-left font-normal">
              Compteur
            </th>
            <th scope="col" className="px-5 py-2 text-right font-normal">
              Avant → semaine
            </th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {legacyKeys.map((key) => (
            <tr key={key} className="border-t">
              <th scope="row" className="px-5 py-2 text-left font-normal">
                {reportMetricLabels[key]}
              </th>
              <td className="px-5 py-2 text-right">
                {previous ? `${integer.format(previous[key])} → ` : ""}
                <span className="font-medium">
                  {integer.format(current[key])}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

const emailStates: Record<string, string> = {
  PENDING: "en attente",
  SENDING: "en cours",
  SENT: "accepté par le service e-mail",
  CANCELLED: "annulé",
  REVIEW_REQUIRED: "à vérifier par le support",
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
      <h2 id="history-title" className="mb-4 text-2xl tracking-tight">
        Historique
      </h2>
      <ol className="divide-y overflow-hidden rounded-2xl border bg-card">
        {reports.map((report) => {
          const current = report.id === selectedId;
          const deliveries = Object.entries(emailStates)
            .map(([state, label]) => ({
              state,
              label,
              count: report.emails.filter((e) => e.state === state).length,
            }))
            .filter((item) => item.count > 0);
          return (
            <li key={report.id}>
              <Link
                href={hrefFor(report.id)}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "relative flex items-center gap-4 px-4 py-3.5 outline-none transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50",
                  current && "bg-muted/60",
                )}
              >
                {current && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-foreground"
                  />
                )}
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-11 shrink-0 flex-col items-center justify-center rounded-xl border leading-none",
                    current
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-background",
                  )}
                >
                  <span className="text-[9px] tracking-wider uppercase opacity-70">
                    Sem.
                  </span>
                  <span className="mt-0.5 font-heading text-base font-bold tabular-nums">
                    {report.label.slice(1)}
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">
                    {report.range}
                  </span>
                  <span className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                    {report.skipped ? (
                      <span className="rounded-full border border-dashed px-2 py-px">
                        Sans activité · e-mail ignoré
                      </span>
                    ) : (
                      <>
                        {report.verdict ? (
                          <span
                            className={cn(
                              "rounded-full border px-2 py-px",
                              report.verdict.tone === "watch" &&
                                "border-destructive/40 text-destructive",
                            )}
                          >
                            {report.verdict.label}
                          </span>
                        ) : (
                          <span className="rounded-full border border-dashed px-2 py-px">
                            Ancien format
                          </span>
                        )}
                        {deliveries.map((item) => (
                          <span
                            key={item.state}
                            className="rounded-full border bg-background px-2 py-px tabular-nums"
                          >
                            {item.count} {item.label}
                          </span>
                        ))}
                      </>
                    )}
                  </span>
                </span>
                {current ? (
                  <span className="hidden shrink-0 rounded-full bg-foreground px-2 py-0.5 text-[11px] text-background sm:inline">
                    Affiché
                  </span>
                ) : (
                  <ChevronRight
                    aria-hidden="true"
                    className="size-4 shrink-0 text-muted-foreground"
                  />
                )}
              </Link>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-xs text-muted-foreground">
        Les 12 dernières semaines. Chaque rapport est figé au moment du calcul :
        un ancien rapport garde ses chiffres d’origine. « Accepté » confirme la
        prise en charge par le service e-mail, pas l’ouverture.
      </p>
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
      <h2 id="definitions-title" className="mb-2 text-2xl tracking-tight">
        Comprendre vos indicateurs
      </h2>
      <Accordion type="multiple" className="w-full">
        {readings.map(({ definition }) => (
          <AccordionItem key={definition.key} value={definition.key}>
            <AccordionTrigger className="text-left">
              {definition.label}
            </AccordionTrigger>
            <AccordionContent className="space-y-2 text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">Question : </span>
                {definition.question}
              </p>
              <p>
                <span className="font-medium text-foreground">Calcul : </span>
                {definitions[definition.key].computed}
              </p>
              <p>
                <span className="font-medium text-foreground">
                  Ne prouve pas :{" "}
                </span>
                {definitions[definition.key].notProven}
              </p>
              <p>
                <span className="font-medium text-foreground">Seuil : </span>
                {definition.kind === "count"
                  ? `valeur comparée à partir de ${definition.minSample} événements ; en dessous, écart absolu.`
                  : `comparaison à partir de ${definition.minSample} ${definition.key === "csat" ? "réponses" : "conversations"} dans la semaine.`}
              </p>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
