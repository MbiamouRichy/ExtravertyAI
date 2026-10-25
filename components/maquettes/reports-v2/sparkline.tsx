"use client";

import {
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";

export type SparkPoint = {
  label: string;
  range: string;
  value: number | null;
  display: string;
  /** Valeur signalée « inhabituelle » dans le rapport de sa propre semaine. */
  flagged: "bad" | "good" | null;
  note?: string;
};

const config = {
  value: { label: "Valeur", color: "var(--muted-foreground)" },
} satisfies ChartConfig;

/**
 * Petit multiple sur 12 semaines : la plage normale en fond, la ligne en encre
 * discrète, et seuls la semaine affichée et les points signalés portent un repère.
 * L'équivalent texte est fourni par le parent (aria-label et tableau des valeurs).
 */
export function ReportSparkline({
  points,
  band,
  label,
}: {
  points: SparkPoint[];
  band: { low: number; high: number } | null;
  label: string;
}) {
  const values = points.flatMap((point) =>
    point.value === null ? [] : [point.value],
  );
  const low = Math.min(...values, band?.low ?? Number.POSITIVE_INFINITY);
  const high = Math.max(...values, band?.high ?? Number.NEGATIVE_INFINITY);
  const pad = (high - low || 1) * 0.12;
  const last = points.length - 1;

  return (
    <div role="img" aria-label={label}>
      <ChartContainer
        config={config}
        className="aspect-auto h-12 w-full"
        aria-hidden="true"
      >
        <LineChart
          data={points}
          margin={{ top: 6, right: 6, bottom: 2, left: 6 }}
          accessibilityLayer={false}
        >
          <XAxis dataKey="label" hide />
          <YAxis hide domain={[low - pad, high + pad]} />
          {band && (
            <ReferenceArea
              y1={band.low}
              y2={band.high}
              fill="var(--muted-foreground)"
              fillOpacity={0.1}
              stroke="none"
              ifOverflow="hidden"
            />
          )}
          {points.map((point) =>
            point.note ? (
              <ReferenceLine
                key={point.label}
                x={point.label}
                stroke="var(--muted-foreground)"
                strokeOpacity={0.6}
                strokeDasharray="2 3"
              />
            ) : null,
          )}
          <ChartTooltip
            cursor={{ stroke: "var(--border)" }}
            content={({ active, payload }) => {
              const point = payload?.[0]?.payload as SparkPoint | undefined;
              if (!active || !point) return null;
              return (
                <div className="grid min-w-36 gap-0.5 rounded-lg border bg-background px-2.5 py-1.5 text-xs shadow-xl">
                  <span className="font-medium text-foreground">
                    {point.display}
                  </span>
                  <span className="text-muted-foreground">
                    {point.label} · {point.range}
                  </span>
                  {point.flagged && (
                    <span className="text-muted-foreground">
                      Inhabituel pour sa semaine{" "}
                      {point.flagged === "bad"
                        ? "(défavorable)"
                        : "(favorable)"}
                    </span>
                  )}
                  {point.note && (
                    <span className="text-muted-foreground">{point.note}</span>
                  )}
                </div>
              );
            }}
          />
          <Line
            dataKey="value"
            type="linear"
            stroke="var(--color-value)"
            strokeWidth={2}
            isAnimationActive={false}
            activeDot={{
              r: 4,
              fill: "var(--foreground)",
              stroke: "var(--background)",
              strokeWidth: 2,
            }}
            dot={(props: { cx?: number; cy?: number; index?: number }) => {
              const { cx, cy, index = 0 } = props;
              const point = points[index];
              if (
                cx === undefined ||
                cy === undefined ||
                !point ||
                point.value === null
              )
                return <g key={index} />;
              if (index === last)
                return (
                  <circle
                    key={index}
                    cx={cx}
                    cy={cy}
                    r={4.5}
                    fill={
                      point.flagged === "bad"
                        ? "var(--destructive)"
                        : "var(--foreground)"
                    }
                    stroke="var(--background)"
                    strokeWidth={2}
                  />
                );
              if (point.flagged)
                return (
                  <circle
                    key={index}
                    cx={cx}
                    cy={cy}
                    r={3.5}
                    fill="var(--background)"
                    stroke={
                      point.flagged === "bad"
                        ? "var(--destructive)"
                        : "var(--foreground)"
                    }
                    strokeWidth={1.5}
                  />
                );
              return <g key={index} />;
            }}
          />
        </LineChart>
      </ChartContainer>
    </div>
  );
}
