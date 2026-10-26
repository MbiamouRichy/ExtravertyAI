"use client";

import { Clock3, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ProspectClassification } from "@/lib/instinct-classification";

/**
 * Instinct IA dans les tableaux : chaque contact affiche un état, y compris
 * « aucun signal » et « en attente », pour que la colonne reste lisible.
 */
export function InstinctCell({
  classification,
}: {
  classification: ProspectClassification | null;
}) {
  const interesting = classification === "interesting";
  const followUp = classification === "follow_up";
  const label = interesting
    ? "Prospect intéressant"
    : followUp
      ? "À suivre"
      : classification === "none"
        ? "Aucun signal"
        : "En attente";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className={cn(
            "inline-flex items-center gap-1 whitespace-nowrap rounded-sm px-1.5 py-px text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-ring",
            interesting && "bg-primary font-medium text-primary-foreground",
            followUp && "border text-foreground",
            !interesting && !followUp && "text-muted-foreground",
          )}
        >
          {interesting && <Sparkles aria-hidden="true" className="size-3" />}
          {followUp && <Clock3 aria-hidden="true" className="size-3" />}
          {label}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-60">
        {classification === null
          ? "Instinct IA : analyse pas encore disponible pour le dernier message, ou qualification désactivée."
          : "Instinct IA : recalculé après chaque nouveau message, selon les objectifs de votre agent."}
      </TooltipContent>
    </Tooltip>
  );
}
