import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Carte du tableau de bord : titre court à gauche, précision discrète à droite. */
export function DashboardCard({
  id,
  title,
  note,
  className,
  children,
}: {
  id: string;
  title: string;
  /** Source ou unité, une ligne au plus (tronquée, lisible au survol). */
  note?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={`${id}-title`}
      className={cn("flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-card", className)}
    >
      <header className="flex min-h-12 items-center justify-between gap-3 px-4 py-3 sm:px-5">
        <h2 id={`${id}-title`} className="shrink-0 text-sm font-semibold tracking-normal">
          {title}
        </h2>
        {note && (
          <p className="min-w-0 truncate text-right text-xs text-muted-foreground" title={note}>
            {note}
          </p>
        )}
      </header>
      {children}
    </section>
  );
}

/** Chiffre clé : libellé, valeur, puis variation ou précision, sur trois lignes fixes. */
export function MetricFigure({
  label,
  value,
  footer,
}: {
  label: string;
  value: string;
  footer: ReactNode;
}) {
  return (
    <>
      <span className="block truncate text-xs text-muted-foreground">{label}</span>
      <span
        className="mt-1 block truncate font-mono text-xl font-medium tabular-nums text-foreground sm:text-2xl"
        title={value}
      >
        {value}
      </span>
      <span className="mt-1.5 flex min-h-5 min-w-0 items-center text-xs text-muted-foreground">
        {footer}
      </span>
    </>
  );
}
