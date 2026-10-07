"use client";
import { useSyncExternalStore } from "react";
const subscribe = () => () => {};
const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const serverZone = () => "";
export function LocalBillingDate({
  value,
  dateOnly = false,
}: {
  value: Date | string | number | null | undefined;
  dateOnly?: boolean;
}) {
  const timeZone = useSyncExternalStore(subscribe, browserZone, serverZone);
  if (value == null) return <span>Non disponible</span>;
  const date = new Date(typeof value === "number" ? value * 1000 : value);
  if (!Number.isFinite(date.getTime())) return <span>Non disponible</span>;
  return (
    <time
      dateTime={date.toISOString()}
      title={timeZone ? "Heure locale · " + timeZone : undefined}
    >
      {timeZone
        ? new Intl.DateTimeFormat("fr-FR", {
            timeZone,
            day: "numeric",
            month: "long",
            year: "numeric",
            ...(!dateOnly
              ? ({
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZoneName: "short",
                } as const)
              : {}),
          }).format(date)
        : "Chargement de la date…"}
    </time>
  );
}
