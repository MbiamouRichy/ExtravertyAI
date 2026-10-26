"use client";

import { useSyncExternalStore } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { useSidebar } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const noop = () => () => undefined;

/** ⌘ sur Mac, Ctrl ailleurs (Ctrl côté serveur, corrigé après hydratation). */
function useModifierKey() {
  return useSyncExternalStore(
    noop,
    () => (/Mac|iPhone|iPad/.test(navigator.userAgent) ? "⌘" : "Ctrl"),
    () => "Ctrl",
  );
}

/**
 * Comme le bouton « Fiche contact » de la messagerie : l’icône montre l’action
 * (fermer ou ouvrir le menu) et l’état est annoncé aux lecteurs d’écran.
 */
export function CustomSidebarTrigger() {
  const { open, openMobile, isMobile, toggleSidebar } = useSidebar();
  const modifier = useModifierKey();
  const expanded = isMobile ? openMobile : open;
  const label = expanded ? "Masquer le menu" : "Afficher le menu";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          data-sidebar="trigger"
          aria-expanded={expanded}
          aria-label={label}
          onClick={toggleSidebar}
        >
          {expanded ? (
            <PanelLeftClose aria-hidden="true" />
          ) : (
            <PanelLeftOpen aria-hidden="true" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent className="flex items-center gap-2 px-2 py-1" side="right">
        {label}
        {!isMobile && (
          <KbdGroup>
            <Kbd>{modifier}</Kbd>
            <Kbd>B</Kbd>
          </KbdGroup>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
