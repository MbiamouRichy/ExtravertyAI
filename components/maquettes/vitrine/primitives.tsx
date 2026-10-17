import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Editorial accent: the italic cut of Crimson Text loaded by the route layout. */
export function Serif({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <em
      className={cn(
        "font-(family-name:--font-vitrine-serif) font-normal tracking-normal italic",
        className,
      )}
    >
      {children}
    </em>
  );
}

/** A registration mark sitting exactly on a frame intersection. */
export function Crosshair({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 12 12"
      className={cn("pointer-events-none absolute hidden size-3 text-foreground/40 sm:block", className)}
    >
      <path d="M6 0v12M0 6h12" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

/** Mono label used for section indexes and small captions. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "font-mono text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground",
        className,
      )}
    >
      {children}
    </p>
  );
}

interface SectionShellProps {
  id?: string;
  labelledBy: string;
  children: ReactNode;
  className?: string;
}

/** A framed section: hairline top rule with registration marks on both corners. */
export function SectionShell({ id, labelledBy, children, className }: SectionShellProps) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={cn("relative scroll-mt-16 border-t", className)}
    >
      <Crosshair className="-left-1.5 -top-1.5" />
      <Crosshair className="-right-1.5 -top-1.5" />
      {children}
    </section>
  );
}

interface SectionIntroProps {
  index: string;
  eyebrow: string;
  titleId: string;
  title: ReactNode;
  description?: ReactNode;
  aside?: ReactNode;
}

export function SectionIntro({ index, eyebrow, titleId, title, description, aside }: SectionIntroProps) {
  return (
    <div className="grid gap-6 px-4 pb-12 pt-20 sm:px-8 md:pt-28 lg:grid-cols-12 lg:gap-8 lg:px-12">
      <Eyebrow className="lg:col-span-3 lg:pt-3">
        <span className="text-foreground">{index}</span>
        <span aria-hidden="true"> / </span>
        {eyebrow}
      </Eyebrow>
      <div className="lg:col-span-6">
        <h2
          id={titleId}
          className="text-balance text-4xl tracking-tight md:text-5xl lg:text-6xl"
        >
          {title}
        </h2>
        {description && (
          <p className="mt-5 max-w-xl text-pretty text-sm text-muted-foreground md:text-base">
            {description}
          </p>
        )}
      </div>
      {aside && <div className="lg:col-span-3 lg:self-end">{aside}</div>}
    </div>
  );
}
