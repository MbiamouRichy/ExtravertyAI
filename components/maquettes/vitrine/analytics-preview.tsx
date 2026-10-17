"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, m, useInView } from "motion/react";
import { ArrowUpRight, Pause, Play } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

import { ANALYTICS_RANGES, FEED_POOL, type AnalyticsRange, type RangeId } from "./data";
import { EASE_OUT, SPRING, useAutoplay } from "./motion";

const FEED_INTERVAL_MS = 2800;
const FEED_SIZE = 5;
const DELTA_LABEL: Record<RangeId, string> = {
  jour: "vs hier",
  semaine: "vs semaine préc.",
  mois: "vs mois préc.",
};

/** Rounds the axis maximum up to the next whole step of its magnitude. */
function niceMax(values: readonly number[]) {
  const max = Math.max(...values);
  const magnitude = 10 ** Math.floor(Math.log10(max));
  return Math.ceil(max / magnitude) * magnitude;
}

export function AnalyticsPreview() {
  const [rangeId, setRangeId] = useState<RangeId>("jour");
  const [paused, setPaused] = useState(false);
  // Five events are already in the feed on first paint.
  const [tick, setTick] = useState(FEED_SIZE - 1);
  const { ref, canPlay, reduce } = useAutoplay<HTMLDivElement>(0.25);

  const range = ANALYTICS_RANGES.find((item) => item.id === rangeId) ?? ANALYTICS_RANGES[0];
  const running = canPlay && !paused;

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setTick((value) => value + 1), FEED_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [running]);

  // Live events only move today's counter; past periods are closed.
  const live = rangeId === "jour" ? tick - (FEED_SIZE - 1) : 0;
  const kpis = range.kpis;

  return (
    <div ref={ref} className="px-4 pb-20 sm:px-8 lg:px-12">
      <div className="overflow-hidden rounded-xl border bg-card shadow-2xl shadow-foreground/5">
        <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <p className="text-sm font-medium">Analytique</p>
            <span className="rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Données de démonstration
            </span>
          </div>
          <div role="group" aria-label="Période" className="inline-flex w-fit rounded-lg border bg-background p-0.5">
            {ANALYTICS_RANGES.map((item) => {
              const selected = item.id === rangeId;
              return (
                <Button
                  key={item.id}
                  type="button"
                  size="xs"
                  variant="ghost"
                  aria-pressed={selected}
                  onClick={() => setRangeId(item.id)}
                  className={cn("relative px-2.5 text-muted-foreground hover:bg-transparent", selected && "text-foreground")}
                >
                  {selected && (
                    <m.span
                      layoutId="vitrine-range-pill"
                      transition={SPRING}
                      aria-hidden="true"
                      className="absolute inset-0 rounded-[inherit] bg-muted"
                    />
                  )}
                  <span className="relative">{item.label}</span>
                </Button>
              );
            })}
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-px border-b bg-border lg:grid-cols-4">
          <Kpi label="Conversations" delta={`+${kpis.delta} %`} deltaLabel={DELTA_LABEL[rangeId]}>
            <NumberFlow value={kpis.conversations + live} locales="fr-FR" />
          </Kpi>
          <Kpi label="Première réponse, médiane">
            <NumberFlow
              value={kpis.medianSeconds}
              locales="fr-FR"
              suffix=" s"
              format={{ minimumFractionDigits: 1, maximumFractionDigits: 1 }}
            />
          </Kpi>
          <Kpi label="Résolues par l’IA" meter={kpis.aiShare}>
            <NumberFlow value={kpis.aiShare} locales="fr-FR" suffix=" %" />
          </Kpi>
          <Kpi label="Transferts à l’équipe">
            <NumberFlow value={kpis.handovers} locales="fr-FR" />
          </Kpi>
        </dl>

        <div className="grid lg:grid-cols-12">
          <VolumeChart range={range} />
          <LiveFeed
            tick={tick}
            running={running}
            paused={paused}
            reduce={reduce}
            onToggle={() => setPaused((value) => !value)}
          />
        </div>
      </div>
    </div>
  );
}

interface KpiProps {
  label: string;
  children: ReactNode;
  delta?: string;
  deltaLabel?: string;
  meter?: number;
}

function Kpi({ label, children, delta, deltaLabel, meter }: KpiProps) {
  return (
    <div className="flex flex-col-reverse justify-end gap-2 bg-card p-4 sm:p-5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd>
        <span className="block font-heading text-3xl font-bold tracking-tight tabular-nums sm:text-4xl">
          {children}
        </span>
        {delta && (
          <span className="mt-1 flex items-center gap-1 font-mono text-[11px]">
            <ArrowUpRight aria-hidden="true" className="size-3" />
            {delta}
            <span className="text-muted-foreground">{deltaLabel}</span>
          </span>
        )}
        {meter !== undefined && (
          <span aria-hidden="true" className="mt-2.5 block h-1 overflow-hidden rounded-full bg-muted">
            <m.span
              className="block h-full rounded-full bg-foreground"
              initial={false}
              animate={{ width: `${meter}%` }}
              transition={{ duration: 0.8, ease: EASE_OUT }}
            />
          </span>
        )}
      </dd>
    </div>
  );
}

function VolumeChart({ range }: { range: AnalyticsRange }) {
  const chartRef = useRef<HTMLDivElement>(null);
  const seen = useInView(chartRef, { once: true, amount: 0.4 });
  const [hovered, setHovered] = useState<number | null>(null);

  const values = range.points.map((point) => point.value);
  const top = niceMax(values);
  const peak = range.points.reduce((best, point) => (point.value > best.value ? point : best));
  const active = hovered !== null ? range.points[hovered] : null;
  const position = hovered !== null ? (hovered + 0.5) / range.points.length : 0;
  const caption = `Conversations par ${range.unit}`;

  return (
    <figure className="min-w-0 border-b p-4 sm:p-6 lg:col-span-8 lg:border-b-0 lg:border-r">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{caption}</span>
        <span className="font-mono text-[11px] text-muted-foreground">
          Pic : {peak.label} · {peak.value.toLocaleString("fr-FR")}
        </span>
      </figcaption>

      <div ref={chartRef} className="relative mt-6 h-52 pl-9 sm:h-60">
        {[1, 0.5, 0].map((ratio) => (
          <div
            key={ratio}
            aria-hidden="true"
            className="absolute inset-x-0 flex items-center gap-2"
            style={{ bottom: `${ratio * 100}%` }}
          >
            <span className="w-7 text-right font-mono text-[10px] leading-none text-muted-foreground">
              {Math.round(top * ratio).toLocaleString("fr-FR")}
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>
        ))}

        <ol
          aria-hidden="true"
          className="absolute inset-y-0 left-9 right-0 flex items-end gap-0.5"
          onPointerLeave={() => setHovered(null)}
        >
          {range.points.map((point, index) => {
            const isLast = index === range.points.length - 1;
            return (
              <li
                key={`${range.id}-${point.label}`}
                className="flex h-full flex-1 items-end justify-center"
                onPointerEnter={() => setHovered(index)}
              >
                <m.span
                  className={cn(
                    "block w-full max-w-6 rounded-t-sm transition-colors",
                    isLast ? "bg-foreground" : "bg-foreground/20",
                    hovered === index && !isLast && "bg-foreground/50",
                  )}
                  initial={{ height: "0%" }}
                  animate={{ height: seen ? `${(point.value / top) * 100}%` : "0%" }}
                  transition={{ ...SPRING, delay: index * 0.015 }}
                />
              </li>
            );
          })}
        </ol>

        <AnimatePresence>
          {active && (
            <m.div
              key="tooltip"
              aria-hidden="true"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className={cn(
                "pointer-events-none absolute z-10 whitespace-nowrap rounded-md border bg-popover px-2.5 py-1.5 text-popover-foreground shadow-md",
                // Keep the tooltip inside the card near both ends of the axis.
                position < 0.15 ? "-translate-x-3" : position > 0.85 ? "-translate-x-[calc(100%-0.75rem)]" : "-translate-x-1/2",
              )}
              style={{
                left: `calc(2.25rem + (100% - 2.25rem) * ${position})`,
                bottom: `calc(${(active.value / top) * 100}% + 0.5rem)`,
              }}
            >
              <span className="block font-mono text-[10px] text-muted-foreground">{active.label}</span>
              <span className="block text-xs font-medium">
                {active.value.toLocaleString("fr-FR")} conversations
              </span>
            </m.div>
          )}
        </AnimatePresence>
      </div>

      <div aria-hidden="true" className="mt-2 flex h-4 gap-0.5 pl-9">
        {range.points.map((point, index) => (
          <span key={point.label} className="relative flex-1">
            {index % range.tickEvery === 0 && (
              <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-[10px] text-muted-foreground">
                {point.label}
              </span>
            )}
          </span>
        ))}
      </div>

      <table className="sr-only">
        <caption>{caption}, données de démonstration</caption>
        <thead>
          <tr>
            <th scope="col">{range.unit}</th>
            <th scope="col">Conversations</th>
          </tr>
        </thead>
        <tbody>
          {range.points.map((point) => (
            <tr key={point.label}>
              <th scope="row">{point.label}</th>
              <td>{point.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

interface LiveFeedProps {
  tick: number;
  running: boolean;
  paused: boolean;
  reduce: boolean;
  onToggle: () => void;
}

function LiveFeed({ tick, running, paused, reduce, onToggle }: LiveFeedProps) {
  const items = Array.from({ length: FEED_SIZE }, (_, offset) => tick - offset)
    .filter((key) => key >= 0)
    .map((key) => ({ key, age: tick - key, event: FEED_POOL[key % FEED_POOL.length] }));

  return (
    <section aria-label="Activité en direct" className="flex flex-col p-4 sm:p-6 lg:col-span-4">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-medium">
          <span className="relative flex size-2">
            {running && (
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-foreground opacity-50" />
            )}
            <span className="relative inline-flex size-2 rounded-full bg-foreground" />
          </span>
          En direct
        </p>
        {!reduce && (
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            onClick={onToggle}
            aria-label={paused ? "Reprendre le flux d’activité" : "Mettre le flux d’activité en pause"}
          >
            {paused ? <Play /> : <Pause />}
          </Button>
        )}
      </div>
      <ol className="relative mt-4 flex flex-col">
        <AnimatePresence initial={false} mode="popLayout">
          {items.map(({ key, age, event }) => (
            <m.li
              key={key}
              layout
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
              transition={SPRING}
              className="flex items-start gap-3 border-b py-3 last:border-b-0"
            >
              <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary font-heading text-[10px] font-bold">
                {event.contact.slice(0, 1)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-xs font-medium">{event.contact}</span>
                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                    {age === 0 ? "à l’instant" : `il y a ${age * 3} s`}
                  </span>
                </span>
                <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span
                    className={cn(
                      "rounded-sm px-1 font-mono text-[9px] uppercase",
                      event.actor === "IA" ? "bg-primary text-primary-foreground" : "border text-foreground",
                    )}
                  >
                    {event.actor}
                  </span>
                  <span className="truncate">{event.action}</span>
                </span>
              </span>
            </m.li>
          ))}
        </AnimatePresence>
      </ol>
    </section>
  );
}
