"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";

/**
 * Zone défilante de hauteur fixe : un bord flou apparaît en haut et/ou en bas
 * uniquement lorsqu’il reste du contenu à faire défiler dans ce sens.
 */
export function ScrollFadeArea({
  children,
  className,
  viewportClassName,
  label,
  surface = "muted",
}: {
  children: ReactNode;
  className?: string;
  /** Classes de la zone qui défile, par exemple une hauteur maximale. */
  viewportClassName?: string;
  /** Couleur du fond sur lequel la zone est posée, reprise par les fondus. */
  surface?: "muted" | "card" | "primary" | "background";
  /** Nom accessible de la zone (elle est focalisable au clavier). */
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ top: false, bottom: false });

  const measure = useCallback(() => {
    const element = ref.current;
    if (!element) return;
    const top = element.scrollTop > 2;
    const bottom =
      element.scrollHeight - element.clientHeight - element.scrollTop > 2;
    setEdges((previous) =>
      previous.top === top && previous.bottom === bottom
        ? previous
        : { top, bottom },
    );
  }, []);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const frame = requestAnimationFrame(measure);
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    for (const child of Array.from(element.children)) observer.observe(child);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [measure, children]);

  return (
    <div className={cn("relative min-h-0", className)}>
      <div
        ref={ref}
        role="region"
        aria-label={label}
        tabIndex={0}
        onScroll={measure}
        className={cn(
          "h-full overflow-y-auto overscroll-contain pr-1 outline-none focus-visible:ring-2 focus-visible:ring-ring/50 [scrollbar-width:thin]",
          viewportClassName,
        )}
      >
        {children}
      </div>
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-8 backdrop-blur-[2px] transition-opacity duration-200 mask-[linear-gradient(to_bottom,black,transparent)]",
          surface === "card"
            ? "bg-linear-to-b from-card to-transparent"
            : surface === "background"
              ? "bg-linear-to-b from-background to-transparent"
              : surface === "primary"
                ? "bg-linear-to-b from-primary to-transparent"
                : "bg-linear-to-b from-muted/80 to-transparent",
          edges.top ? "opacity-100" : "opacity-0",
        )}
      />
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 h-10 backdrop-blur-[2px] transition-opacity duration-200 mask-[linear-gradient(to_top,black,transparent)]",
          surface === "card"
            ? "bg-linear-to-t from-card to-transparent"
            : surface === "background"
              ? "bg-linear-to-t from-background to-transparent"
              : surface === "primary"
                ? "bg-linear-to-t from-primary to-transparent"
                : "bg-linear-to-t from-muted/80 to-transparent",
          edges.bottom ? "opacity-100" : "opacity-0",
        )}
      />
    </div>
  );
}
