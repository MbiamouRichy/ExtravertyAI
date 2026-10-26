import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { formatDelta, formatValue, type ValueFormat } from "./format";

/** Carte de graphique : titre, description, chiffre clé optionnel, contenu. */
export function Panel({
  title,
  description,
  headline,
  aside,
  className,
  children,
}: {
  title: string;
  description?: string;
  headline?: ReactNode;
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("flex min-w-0 flex-col rounded-2xl border bg-card", className)}>
      <header className="flex items-start justify-between gap-3 border-b px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-normal">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
          {headline}
        </div>
        {aside}
      </header>
      <div className="flex-1 p-4 sm:p-5">{children}</div>
    </section>
  );
}

/** Évolution par rapport à la période précédente, avec flèche et signe (jamais la couleur seule). */
export function DeltaBadge({
  value,
  label,
  inverse = false,
}: {
  value: number | null;
  label: string;
  /** Une baisse est une bonne nouvelle (ex. désabonnements). */
  inverse?: boolean;
}) {
  const good = value === null ? true : inverse ? value < 0 : value > 0;
  const flat = value === 0;
  return (
    <span className="flex min-w-0 max-w-full items-center gap-1 text-xs text-muted-foreground">
      <span
        className={cn(
          "inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium tabular-nums",
          flat ? "bg-muted text-foreground" : good ? "bg-muted text-foreground" : "bg-destructive/10 text-destructive",
        )}
      >
        <span aria-hidden="true">{flat ? "→" : value === null || value > 0 ? "↗" : "↘"}</span>
        {formatDelta(value)}
      </span>
      {label && <span className="min-w-0 truncate">{label}</span>}
    </span>
  );
}

export function StatTile({
  label,
  value,
  format = "number",
  currency,
  hint,
  children,
}: {
  label: string;
  value: number | null;
  format?: ValueFormat;
  currency?: string;
  hint?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col rounded-2xl border bg-card">
      <div className="px-4 pt-4 pb-3">
        <p className="truncate text-xs text-muted-foreground">{label}</p>
        <p
          className="mt-2 truncate font-mono text-2xl font-medium tabular-nums sm:text-3xl"
          title={formatValue(value, format, currency)}
        >
          {formatValue(value, format, currency, format === "currency")}
        </p>
        {hint && <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children && <div className="mt-auto border-t bg-muted/30 px-4 py-2.5">{children}</div>}
    </div>
  );
}
