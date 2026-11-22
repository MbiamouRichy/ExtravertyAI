"use client";

import { usePathname } from "next/navigation";
import { CircleHelp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { helpLinkForAppPath } from "@/lib/help-center/app-links";

/**
 * Bouton « Aide » de l'en-tête : il ouvre, dans un nouvel onglet, l'article du
 * centre d'aide qui correspond à la page affichée. Le nouvel onglet garde la
 * saisie en cours (formulaire, configuration) intacte.
 */
export function HelpButton() {
  const link = helpLinkForAppPath(usePathname());
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button asChild variant="outline" size="icon-sm">
          <a href={link.href} target="_blank" rel="noopener">
            <CircleHelp aria-hidden="true" />
            <span className="sr-only">{`Aide : ${link.title} (nouvel onglet)`}</span>
          </a>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{`Aide : ${link.title}`}</TooltipContent>
    </Tooltip>
  );
}
