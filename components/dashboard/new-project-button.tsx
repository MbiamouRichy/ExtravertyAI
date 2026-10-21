"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Composant client volontaire : passé depuis un composant serveur, le <Link>
// arrive au rendu SSR comme référence RSC « lazy » que Radix Slot ignore
// (rendu null). Le lien n'existait alors que côté client et cassait
// l'hydratation de tout l'en-tête.
export function NewProjectButton() {
  return (
    <Tooltip>
      <TooltipTrigger asChild className="cursor-pointer">
        <Button asChild size="icon-sm">
          <Link href="/projects/new" aria-label="Nouveau projet">
            <Plus aria-hidden="true" />
          </Link>
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-sm leading-relaxed">Nouveau projet</p>
      </TooltipContent>
    </Tooltip>
  );
}
