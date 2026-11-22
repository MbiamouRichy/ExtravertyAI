import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Briques des maquettes d’écran du centre d’aide. Ce sont des illustrations :
 * rien n’y est cliquable, et chaque figure est décrite en texte à côté
 * (lib/help-center/content.ts) pour les lecteurs d’écran.
 */

export function MockWindow({
  url,
  children,
  className,
}: {
  url: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-xl border bg-background shadow-xs", className)}>
      <div className="flex items-center gap-3 border-b bg-muted/60 px-3 py-2">
        <div className="flex gap-1.5" aria-hidden="true">
          <span className="size-2.5 rounded-full bg-muted-foreground/30" />
          <span className="size-2.5 rounded-full bg-muted-foreground/30" />
          <span className="size-2.5 rounded-full bg-muted-foreground/30" />
        </div>
        <div className="min-w-0 flex-1 truncate rounded-md bg-background px-2.5 py-1 text-[11px] text-muted-foreground">
          {url}
        </div>
      </div>
      <div className="p-4 sm:p-6">{children}</div>
    </div>
  );
}

export function MockHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div>
      <p className="font-heading text-lg font-bold tracking-tight text-foreground">{title}</p>
      {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
    </div>
  );
}

/** Pastille numérotée qui renvoie à une étape du texte. */
export function Pin({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-foreground font-mono text-[10px] font-semibold text-background">
      {children}
    </span>
  );
}

export function MockLabel({ pin, children }: { pin?: ReactNode; children: ReactNode }) {
  return (
    <div className="mb-1.5 flex items-center gap-2 text-xs font-medium text-foreground">
      {pin !== undefined && <Pin>{pin}</Pin>}
      {children}
    </div>
  );
}

export function MockField({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "flex h-9 items-center gap-2 rounded-md border bg-background px-3 text-xs text-foreground",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Imitation d’un bouton de l’application, sans rôle interactif. */
export function MockButton({
  children,
  variant = "default",
  className,
}: {
  children: ReactNode;
  variant?: "default" | "outline";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-3 text-xs font-medium whitespace-nowrap [&_svg]:size-3.5",
        variant === "default" ? "bg-primary text-primary-foreground" : "border bg-background text-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function MockOption({
  title,
  hint,
  selected = false,
}: {
  title: string;
  hint?: string;
  selected?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-lg border p-2.5",
        selected ? "border-foreground bg-muted/60" : "bg-background",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex size-3.5 shrink-0 items-center justify-center rounded-full border",
          selected && "border-foreground",
        )}
      >
        {selected && <span className="size-1.5 rounded-full bg-foreground" />}
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-semibold text-foreground">{title}</span>
        {hint && <span className="block text-[11px] leading-snug text-muted-foreground">{hint}</span>}
      </span>
    </div>
  );
}

export const SETUP_STEPS = ["Entreprise", "Objectifs", "Profil", "Mission", "Connaissances", "Test"] as const;

/** Barre de progression de l’assistant de configuration. */
export function MockStepper({ current }: { current: number }) {
  return (
    <div>
      <ol className="grid grid-cols-6 gap-1.5">
        {SETUP_STEPS.map((label, index) => (
          <li key={label} className="min-w-0">
            <span className={cn("block h-1 rounded-full", index <= current ? "bg-foreground" : "bg-muted")} />
            <span
              className={cn(
                "mt-1.5 hidden truncate text-[10px] sm:block",
                index === current ? "font-semibold text-foreground" : "text-muted-foreground",
              )}
            >
              {label}
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
        Étape {current + 1} sur {SETUP_STEPS.length}
      </p>
    </div>
  );
}

/** Spinner discret des états « en attente ». */
export function MockWaiting({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span
        aria-hidden="true"
        className="size-3.5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground motion-reduce:animate-none"
      />
      {children}
    </div>
  );
}
