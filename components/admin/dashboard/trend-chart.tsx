"use client";

import { useId } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { formatBucket, formatValue, type ValueFormat } from "./format";

export type TrendSeries = { key: string; label: string; color: string };
type Point = { key: string } & Record<string, number | string | null>;

/**
 * Courbe, aire ou barres sur un seul axe. Survol : repère et infobulle ;
 * lecteurs d'écran : tableau des valeurs.
 */
export function TrendChart({
  data,
  series,
  unit,
  kind = "area",
  format = "number",
  currency,
  extraTooltip,
  height = 240,
}: {
  data: Point[];
  series: TrendSeries[];
  unit: "day" | "month";
  kind?: "area" | "bar" | "line";
  format?: ValueFormat;
  currency?: string;
  /** Valeurs complémentaires montrées dans l'infobulle (ex. effectifs d'un taux). */
  extraTooltip?: { key: string; label: string; format?: ValueFormat }[];
  height?: number;
}) {
  const id = useId().replace(/:/g, "");
  const config: ChartConfig = Object.fromEntries(
    series.map((item) => [item.key, { label: item.label, color: item.color }]),
  );
  const empty = !data.some((point) =>
    series.some((item) => typeof point[item.key] === "number" && (point[item.key] as number) > 0),
  );
  const axisFormat = (value: number) => formatValue(value, format, currency, true);

  const grid = (
    <>
      <CartesianGrid vertical={false} strokeDasharray="3 5" className="stroke-border/60" />
      <XAxis
        dataKey="key"
        tickFormatter={(value) => formatBucket(String(value), unit)}
        tickLine={false}
        axisLine={false}
        tickMargin={10}
        minTickGap={24}
        fontSize={11}
      />
      <YAxis
        tickLine={false}
        axisLine={false}
        width={52}
        tickMargin={6}
        fontSize={11}
        allowDecimals={format !== "number"}
        tickFormatter={axisFormat}
        domain={format === "percent" ? [0, (max: number) => Math.min(1, Math.max(max, 0.1))] : [0, "auto"]}
      />
      <Tooltip
        cursor={kind === "bar" ? { fill: "var(--muted)", opacity: 0.5 } : { stroke: "var(--border)", strokeDasharray: "4 4" }}
        content={({ active, payload, label }) => {
          if (!active || !payload?.length) return null;
          const point = payload[0].payload as Point;
          return (
            <div className="grid min-w-36 gap-1.5 rounded-lg border bg-background px-2.5 py-1.5 text-xs shadow-xl">
              <p className="font-medium">{formatBucket(String(label), unit, true)}</p>
              {series.map((item) => (
                <div key={item.key} className="flex items-center justify-between gap-4">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <span aria-hidden="true" className="size-2 rounded-[2px]" style={{ background: item.color }} />
                    {item.label}
                  </span>
                  <span className="font-mono font-medium tabular-nums text-foreground">
                    {formatValue(point[item.key] as number | null, format, currency)}
                  </span>
                </div>
              ))}
              {extraTooltip?.map((extra) => (
                <div key={extra.key} className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">{extra.label}</span>
                  <span className="font-mono tabular-nums text-foreground">
                    {formatValue(point[extra.key] as number | null, extra.format ?? "number", currency)}
                  </span>
                </div>
              ))}
            </div>
          );
        }}
      />
    </>
  );

  return (
    <figure className="relative min-w-0">
      <ChartContainer config={config} className="aspect-auto w-full" style={{ height }}>
        {kind === "bar" ? (
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%">
            {grid}
            {series.map((item) => (
              <Bar key={item.key} dataKey={item.key} fill={`var(--color-${item.key})`} radius={[4, 4, 0, 0]} maxBarSize={28} />
            ))}
          </BarChart>
        ) : kind === "line" ? (
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            {grid}
            {series.map((item) => (
              <Line
                key={item.key}
                dataKey={item.key}
                type="monotone"
                stroke={`var(--color-${item.key})`}
                strokeWidth={2}
                dot={data.length <= 24 ? { r: 3, strokeWidth: 2, fill: "var(--background)" } : false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--background)" }}
                connectNulls
              />
            ))}
          </LineChart>
        ) : (
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              {series.map((item) => (
                <linearGradient key={item.key} id={`${id}-${item.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={`var(--color-${item.key})`} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={`var(--color-${item.key})`} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            {grid}
            {series.map((item) => (
              <Area
                key={item.key}
                dataKey={item.key}
                type="monotone"
                stroke={`var(--color-${item.key})`}
                strokeWidth={2}
                fill={`url(#${id}-${item.key})`}
                dot={data.length <= 24 ? { r: 3, strokeWidth: 2, fill: "var(--background)" } : false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--background)" }}
              />
            ))}
          </AreaChart>
        )}
      </ChartContainer>
      {empty && (
        <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
          Pas encore de données sur cette période
        </p>
      )}
      {series.length > 1 && (
        <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {series.map((item) => (
            <span key={item.key} className="flex items-center gap-1.5">
              <span aria-hidden="true" className="size-2 rounded-[2px]" style={{ background: item.color }} />
              {item.label}
            </span>
          ))}
        </figcaption>
      )}
      <table className="sr-only">
        <thead>
          <tr>
            <th scope="col">Période</th>
            {series.map((item) => (
              <th key={item.key} scope="col">{item.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((point) => (
            <tr key={point.key}>
              <th scope="row">{formatBucket(point.key, unit, true)}</th>
              {series.map((item) => (
                <td key={item.key}>{formatValue(point[item.key] as number | null, format, currency)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
