"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Classes écrites en entier : Tailwind ne génère que ce qu’il lit dans le code.
const CLAMP = {
  4: "line-clamp-4",
  6: "line-clamp-6",
} as const;

/**
 * Texte long replié sur quelques lignes. « Afficher plus » n’apparaît que si
 * le texte dépasse réellement ; replié après lecture, le bloc revient à
 * l’écran au lieu de laisser le lecteur plus bas, sur l’élément suivant.
 */
export function ExpandableText({
  content,
  lines = 4,
  className,
  toggleClassName,
  scrollTarget,
}: {
  content: string;
  lines?: keyof typeof CLAMP;
  className?: string;
  toggleClassName?: string;
  /** Sélecteur de l’ancêtre à ramener à l’écran au repli (`li`, `article`). */
  scrollTarget: string;
}) {
  const id = useId();
  const ref = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const element = ref.current;
    // Déplié, le texte ne déborde plus : on garde la dernière mesure repliée.
    if (!element || expanded) return;
    const observer = new ResizeObserver(() =>
      setOverflows(element.scrollHeight - element.clientHeight > 1),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [expanded, content]);

  return (
    <>
      <p
        ref={ref}
        id={id}
        dir="auto"
        className={cn(
          "whitespace-pre-wrap wrap-anywhere",
          !expanded && CLAMP[lines],
          className,
        )}
      >
        {content}
      </p>
      {(overflows || expanded) && (
        <Button
          type="button"
          variant="link"
          size="xs"
          aria-expanded={expanded}
          aria-controls={id}
          onClick={() => {
            setExpanded(!expanded);
            if (expanded)
              requestAnimationFrame(() =>
                ref.current
                  ?.closest(scrollTarget)
                  ?.scrollIntoView({ block: "nearest" }),
              );
          }}
          className={cn(
            "h-auto px-0 py-0.5 text-muted-foreground hover:text-foreground",
            toggleClassName,
          )}
        >
          {expanded ? "Réduire" : "Afficher plus"}
          <ChevronDown
            aria-hidden="true"
            className={cn(
              "transition-transform motion-reduce:transition-none",
              expanded && "rotate-180",
            )}
          />
        </Button>
      )}
    </>
  );
}
