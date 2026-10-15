import { CalendarClock } from "lucide-react";

import {
  HEATMAP_SLOTS,
  HEATMAP_SLOT_HOURS,
  HEATMAP_WEEKDAYS,
  formatNumberFr,
} from "@/lib/analytics";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AnalyticsCard } from "./analytics-card";
import { ChartEmptyState } from "./chart-empty-state";

const FULL_DAYS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
const slots = Array.from({ length: HEATMAP_SLOTS }, (_, index) => index * HEATMAP_SLOT_HOURS);

function shade(count: number, max: number) {
  // Single-hue sequential scale derived from the theme foreground.
  const ratio = max ? count / max : 0;
  return `color-mix(in oklch, var(--foreground) ${Math.round(5 + ratio * 85)}%, var(--card))`;
}

export function ActivityHeatmapCard({
  heatmap,
  rangeLabel,
  timeZone,
}: {
  heatmap: number[][];
  rangeLabel: string;
  timeZone: string;
}) {
  const max = Math.max(0, ...heatmap.flat());
  let peak = { day: 0, slot: 0, count: 0 };
  heatmap.forEach((row, day) =>
    row.forEach((count, slot) => {
      if (count > peak.count) peak = { day, slot, count };
    }),
  );

  return (
    <AnalyticsCard
      title="Quand vos clients écrivent"
      description={`Messages reçus par jour et créneau de 2 h · ${rangeLabel}`}
      aside={<span className="text-xs text-muted-foreground">Heure locale · {timeZone}</span>}
      footer={
        max > 0 ? (
          <>
            Pic d’activité le {FULL_DAYS[peak.day]} entre {slots[peak.slot]} h et{" "}
            {slots[peak.slot] + HEATMAP_SLOT_HOURS} h : planifiez la présence de
            l’équipe sur ces créneaux.
          </>
        ) : undefined
      }
    >
      {max === 0 ? (
        <ChartEmptyState
          icon={CalendarClock}
          title="Aucun message reçu"
          description="La carte d’affluence se remplira avec les messages de vos clients."
        />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] table-fixed border-separate border-spacing-1 text-xs">
              <caption className="sr-only">
                Nombre de messages reçus par jour de la semaine et par créneau de deux heures
              </caption>
              <thead>
                <tr>
                  <th scope="col" className="w-10">
                    <span className="sr-only">Jour</span>
                  </th>
                  {slots.map((hour) => (
                    <th key={hour} scope="col" className="font-mono text-[10px] font-normal text-muted-foreground">
                      {hour}h
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heatmap.map((row, day) => (
                  <tr key={HEATMAP_WEEKDAYS[day]}>
                    <th scope="row" className="pr-1 text-left font-normal text-muted-foreground">
                      {HEATMAP_WEEKDAYS[day]}
                    </th>
                    {row.map((count, slot) => (
                      <td key={slot} className="p-0">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              tabIndex={0}
                              className="h-7 rounded-[4px] outline-none ring-offset-1 ring-offset-card hover:ring-2 hover:ring-foreground focus-visible:ring-2 focus-visible:ring-ring"
                              style={{ backgroundColor: shade(count, max) }}
                            >
                              <span className="sr-only">
                                {FULL_DAYS[day]}, {slots[slot]} h : {count} messages
                              </span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            {HEATMAP_WEEKDAYS[day]} · {slots[slot]} h – {slots[slot] + HEATMAP_SLOT_HOURS} h :{" "}
                            {formatNumberFr(count)} message{count > 1 ? "s" : ""}
                          </TooltipContent>
                        </Tooltip>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div aria-hidden="true" className="mt-3 flex items-center justify-end gap-1.5 text-[11px] text-muted-foreground">
            Moins
            {[0.1, 0.3, 0.5, 0.75, 1].map((ratio) => (
              <span
                key={ratio}
                className="size-3 rounded-[3px]"
                style={{ backgroundColor: shade(ratio, 1) }}
              />
            ))}
            Plus
          </div>
        </>
      )}
    </AnalyticsCard>
  );
}
