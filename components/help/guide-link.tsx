import { LifeBuoy } from "lucide-react";

import type { AppHelpLink } from "@/lib/help-center/app-links";
import { cn } from "@/lib/utils";

/**
 * Lien discret vers la section du guide qui explique l'écran affiché, posé aux
 * moments où l'on bloque (création du projet, vérification, configuration,
 * connexion WhatsApp). Nouvel onglet : la saisie en cours reste intacte.
 */
export function GuideLink({
  link,
  label = "Guide pas à pas",
  className,
}: {
  link: AppHelpLink;
  label?: string;
  className?: string;
}) {
  return (
    <a
      href={link.href}
      target="_blank"
      rel="noopener"
      title={link.title}
      className={cn(
        "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-md px-1 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        className,
      )}
    >
      <LifeBuoy aria-hidden="true" className="size-4" />
      {label}
      <span className="sr-only">{` : ${link.title} (nouvel onglet)`}</span>
    </a>
  );
}
