"use client";

import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, Line, XAxis, YAxis } from "recharts";
import {
  ArrowDownRight,
  ArrowUpRight,
  Bot,
  Clock3,
  Download,
  Info,
  Sparkles,
  Table2,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import {
  heatmap,
  hours,
  instinctFunnel,
  kpis,
  periods,
  responders,
  sources,
  statuses,
  topContacts,
  volumeSeries,
  weekdays,
  type Kpi,
  type Period,
} from "./data";

const volumeConfig = {
  received: { label: "Reçus", color: "var(--foreground)" },
  sent: { label: "Envoyés", color: "var(--muted-foreground)" },
} satisfies ChartConfig;

const number = new Intl.NumberFormat("fr-FR");

function Card({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const id = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <section aria-labelledby={id} className={cn("flex min-w-0 flex-col rounded-2xl border bg-card p-5", className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 id={id} className="font-heading text-base font-semibold tracking-tight">
            {title}
          </h2>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 100;
      const y = 28 - ((value - min) / (max - min || 1)) * 24;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg aria-hidden="true" viewBox="0 0 100 30" preserveAspectRatio="none" className="h-8 w-full">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function KpiTile({ kpi }: { kpi: Kpi }) {
  const up = kpi.delta > 0;
  const good = kpi.lowerIsBetter ? !up : up;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <li className="flex flex-col rounded-2xl border bg-card p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{kpi.label}</p>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-xs" aria-label={`À propos : ${kpi.label}`}>
              <Info />
            </Button>
          </TooltipTrigger>
          <TooltipContent className="max-w-60">{kpi.hint}</TooltipContent>
        </Tooltip>
      </div>
      <p className="mt-2 font-heading text-3xl font-bold tracking-tight tabular-nums">{kpi.value}</p>
      <p className="mt-2 flex items-center gap-1.5 text-xs">
        <span
          className={cn(
            "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium tabular-nums",
            good ? "bg-primary text-primary-foreground" : "border text-foreground",
          )}
        >
          <Icon aria-hidden="true" className="size-3" />
          {up ? "+" : "−"}
          {Math.abs(kpi.delta).toLocaleString("fr-FR")} %
        </span>
        <span className="text-muted-foreground">vs période précédente</span>
      </p>
      <div className="mt-4 text-foreground/70">
        <Sparkline values={kpi.spark} />
      </div>
    </li>
  );
}

function ShareBar({ label, value, max, suffix = "" }: { label: string; value: number; max: number; suffix?: string }) {
  return (
    <li>
      <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
        <span>{label}</span>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {number.format(value)}
          {suffix}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div
          className="h-full rounded-full bg-foreground/80 motion-safe:transition-[width] motion-safe:duration-700"
          style={{ width: `${Math.max(2, (value / max) * 100)}%` }}
        />
      </div>
    </li>
  );
}

export function AnalyticsDashboard({ projectName }: { projectName: string }) {
  const [period, setPeriod] = useState<Period>("30d");
  const [showTable, setShowTable] = useState(false);
  const days = periods.find((item) => item.id === period)?.days ?? 30;

  const series = useMemo(() => volumeSeries(days), [days]);
  const tiles = useMemo(() => kpis(days), [days]);
  const totals = useMemo(
    () => ({
      received: series.reduce((sum, point) => sum + point.received, 0),
      sent: series.reduce((sum, point) => sum + point.sent, 0),
    }),
    [series],
  );
  const statusTotal = statuses.reduce((sum, item) => sum + item.value, 0);
  const funnelMax = instinctFunnel[0].value;

  return (
    <main id="contenu" className="min-w-0 bg-muted/20">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 sm:p-6 xl:p-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">{projectName}</p>
            <h1 className="mt-1 text-3xl md:text-4xl">Analytique</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {series[0]?.label} – {series.at(-1)?.label} · heure locale
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div role="group" aria-label="Période" className="flex gap-1 rounded-lg border bg-background p-1">
              {periods.map((item) => (
                <Button
                  key={item.id}
                  size="sm"
                  variant={period === item.id ? "default" : "ghost"}
                  aria-pressed={period === item.id}
                  onClick={() => setPeriod(item.id)}
                  className="h-7"
                >
                  {item.label}
                </Button>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={() => toast("Maquette : export CSV simulé")}>
              <Download />
              Exporter
            </Button>
          </div>
        </header>

        <section aria-label="Indicateurs clés">
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {tiles.map((kpi) => (
              <KpiTile key={kpi.id} kpi={kpi} />
            ))}
          </ul>
        </section>

        <div className="grid gap-4 xl:grid-cols-3">
          <Card
            title="Volume des échanges"
            description={`${number.format(totals.received)} reçus · ${number.format(totals.sent)} envoyés`}
            className="xl:col-span-2"
            action={
              <Button
                variant="ghost"
                size="sm"
                aria-pressed={showTable}
                onClick={() => setShowTable((value) => !value)}
              >
                <Table2 />
                {showTable ? "Graphique" : "Tableau"}
              </Button>
            }
          >
            {showTable ? (
              <div className="max-h-72 overflow-auto rounded-lg border">
                <table className="w-full text-sm">
                  <caption className="sr-only">Messages reçus et envoyés par jour</caption>
                  <thead className="sticky top-0 bg-card text-xs text-muted-foreground">
                    <tr className="border-b">
                      <th scope="col" className="px-3 py-2 text-left font-normal">Jour</th>
                      <th scope="col" className="px-3 py-2 text-right font-normal">Reçus</th>
                      <th scope="col" className="px-3 py-2 text-right font-normal">Envoyés</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {series.map((point) => (
                      <tr key={point.label} className="border-b last:border-0">
                        <th scope="row" className="px-3 py-1.5 text-left font-normal">{point.label}</th>
                        <td className="px-3 py-1.5 text-right">{number.format(point.received)}</td>
                        <td className="px-3 py-1.5 text-right">{number.format(point.sent)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <ChartContainer config={volumeConfig} className="aspect-auto h-72 w-full">
                <AreaChart data={series} margin={{ left: 0, right: 8, top: 8 }}>
                  <defs>
                    <linearGradient id="fill-received" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-received)" stopOpacity={0.18} />
                      <stop offset="100%" stopColor="var(--color-received)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    minTickGap={28}
                  />
                  <YAxis tickLine={false} axisLine={false} width={36} />
                  <ChartTooltip cursor content={<ChartTooltipContent indicator="line" />} />
                  <Area
                    dataKey="received"
                    type="monotone"
                    stroke="var(--color-received)"
                    strokeWidth={2}
                    fill="url(#fill-received)"
                    activeDot={{ r: 4 }}
                  />
                  <Line
                    dataKey="sent"
                    type="monotone"
                    stroke="var(--color-sent)"
                    strokeWidth={2}
                    strokeDasharray="5 4"
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                  <ChartLegend content={<ChartLegendContent />} />
                </AreaChart>
              </ChartContainer>
            )}
          </Card>

          <div className="grid gap-4">
            <Card title="Qui répond ?" description="Réponses envoyées sur la période">
              <div className="flex h-3 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
                {responders.map((item, index) => (
                  <div
                    key={item.id}
                    className={index === 0 ? "bg-foreground" : "bg-muted-foreground/40"}
                    style={{ width: `${item.share}%` }}
                  />
                ))}
              </div>
              <ul className="mt-4 grid grid-cols-2 gap-3">
                {responders.map((item, index) => {
                  const Icon = index === 0 ? Bot : UsersRound;
                  return (
                    <li key={item.id} className="rounded-xl border p-3">
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Icon aria-hidden="true" className="size-3.5" />
                        {item.label}
                      </p>
                      <p className="mt-1 font-heading text-2xl font-bold tabular-nums">{item.share} %</p>
                    </li>
                  );
                })}
              </ul>
            </Card>

            <Card title="Instinct IA" description="Du contact actif au prospect intéressant">
              <ol className="space-y-3">
                {instinctFunnel.map((step) => (
                  <ShareBar key={step.id} label={step.label} value={step.value} max={funnelMax} />
                ))}
              </ol>
              <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Sparkles aria-hidden="true" className="size-3.5" />
                {((instinctFunnel[2].value / funnelMax) * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %
                des contacts actifs sont des prospects intéressants.
              </p>
            </Card>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <Card
            title="Quand vos clients écrivent"
            description="Messages reçus par jour et par heure · plus foncé = plus de messages"
            className="xl:col-span-2"
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem] table-fixed border-separate border-spacing-1 text-xs">
                <caption className="sr-only">Nombre de messages reçus par jour de la semaine et par heure</caption>
                <thead>
                  <tr>
                    <th scope="col" className="w-10" />
                    {hours.map((hour) => (
                      <th key={hour} scope="col" className="font-mono text-[10px] font-normal text-muted-foreground">
                        {hour}h
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {heatmap.map((row, index) => (
                    <tr key={weekdays[index]}>
                      <th scope="row" className="pr-1 text-left font-normal text-muted-foreground">
                        {weekdays[index]}
                      </th>
                      {row.map((cell) => (
                        <td key={cell.hour} className="p-0">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                tabIndex={0}
                                className="h-7 rounded-[4px] outline-none ring-offset-1 ring-offset-card hover:ring-2 hover:ring-foreground focus-visible:ring-2 focus-visible:ring-ring"
                                style={{
                                  backgroundColor: `color-mix(in oklch, var(--foreground) ${Math.round(6 + cell.intensity * 84)}%, var(--card))`,
                                }}
                              >
                                <span className="sr-only">{cell.count} messages</span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              {cell.day} · {cell.hour} h – {cell.hour + 1} h : {cell.count} messages
                            </TooltipContent>
                          </Tooltip>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex items-center justify-end gap-2 text-[11px] text-muted-foreground" aria-hidden="true">
              Moins
              {[10, 30, 50, 70, 90].map((step) => (
                <span
                  key={step}
                  className="size-3 rounded-[3px]"
                  style={{ backgroundColor: `color-mix(in oklch, var(--foreground) ${step}%, var(--card))` }}
                />
              ))}
              Plus
            </div>
          </Card>

          <Card title="Livraison des messages" description={`${number.format(statusTotal)} messages sortants`}>
            <ol className="space-y-3">
              {statuses.map((item) => (
                <ShareBar key={item.id} label={item.label} value={item.value} max={statuses[0].value} />
              ))}
            </ol>
            <p className="mt-4 text-xs text-muted-foreground">
              Taux d’échec :{" "}
              <span className="font-medium text-foreground">
                {((statuses[4].value / statusTotal) * 100).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} %
              </span>
            </p>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <Card title="Contacts les plus actifs" description="Classés par nombre de messages" className="xl:col-span-2">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[32rem] text-sm">
                <caption className="sr-only">Contacts les plus actifs sur la période</caption>
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b">
                    <th scope="col" className="py-2 pr-3 text-left font-normal">Contact</th>
                    <th scope="col" className="px-3 py-2 text-left font-normal">Instinct IA</th>
                    <th scope="col" className="px-3 py-2 text-left font-normal">Géré par</th>
                    <th scope="col" className="px-3 py-2 text-right font-normal">Messages</th>
                    <th scope="col" className="py-2 pl-3 text-right font-normal">Activité</th>
                  </tr>
                </thead>
                <tbody>
                  {topContacts.map((contact) => (
                    <tr key={contact.id} className="border-b last:border-0">
                      <th scope="row" className="py-3 pr-3 text-left font-medium">{contact.name}</th>
                      <td className="px-3 py-3">
                        {contact.instinct === "interesting" ? (
                          <span className="inline-flex items-center gap-1 rounded-sm bg-primary px-1.5 py-px text-[11px] font-medium text-primary-foreground">
                            <Sparkles aria-hidden="true" className="size-3" />
                            Intéressant
                          </span>
                        ) : contact.instinct === "follow_up" ? (
                          <span className="inline-flex items-center gap-1 rounded-sm border px-1.5 text-[11px] text-muted-foreground">
                            <Clock3 aria-hidden="true" className="size-3" />À suivre
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-xs">
                        <span className="inline-flex items-center gap-1.5">
                          {contact.ai ? <Bot aria-hidden="true" className="size-3.5" /> : <UsersRound aria-hidden="true" className="size-3.5" />}
                          {contact.ai ? "Assistant IA" : "Équipe"}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums">{contact.messages}</td>
                      <td className="py-3 pl-3 text-right text-xs text-muted-foreground">{contact.last}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="Origine des conversations" description="Part des nouveaux contacts">
            <ol className="space-y-3">
              {sources.map((item) => (
                <ShareBar key={item.id} label={item.label} value={item.value} max={sources[0].value} suffix=" %" />
              ))}
            </ol>
          </Card>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Maquette · données fictives. Les indicateurs réels proviennent de vos conversations WhatsApp.
        </p>
      </div>
    </main>
  );
}
