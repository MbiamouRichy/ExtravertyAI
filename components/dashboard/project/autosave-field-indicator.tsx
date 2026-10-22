import { Check, CircleAlert, Loader2 } from "lucide-react";

import type { AutosaveStatus } from "@/lib/autosave-queue";
import { cn } from "@/lib/utils";

const ANNOUNCE: Record<AutosaveStatus, string> = {
  idle: "",
  waiting: "Modification en attente d’enregistrement.",
  saving: "Enregistrement…",
  saved: "Modification enregistrée.",
  invalid: "Complétez le champ pour enregistrer.",
  error: "Échec de l’enregistrement.",
};

/**
 * État d’enregistrement automatique affiché dans le champ lui-même, sans texte :
 * point pulsé en attente, spinner pendant l’envoi, coche éphémère une fois
 * enregistré, alerte en cas d’échec. Une annonce invisible relaie l’état aux
 * lecteurs d’écran.
 */
export function AutosaveFieldIcon({ status }: { status: AutosaveStatus }) {
  return (
    <span className="relative flex size-4 items-center justify-center">
      {status === "waiting" && (
        <span
          aria-hidden="true"
          className="size-1.5 rounded-full bg-muted-foreground motion-safe:animate-pulse"
        />
      )}
      {status === "saving" && (
        <Loader2
          aria-hidden="true"
          className="size-4 animate-spin text-muted-foreground motion-reduce:animate-none"
        />
      )}
      {status === "saved" && (
        <Check aria-hidden="true" className="save-check size-4 text-foreground" />
      )}
      {status === "error" && (
        <CircleAlert aria-hidden="true" className="size-4 text-destructive" />
      )}
      <span role="status" aria-live="polite" className="sr-only">
        {ANNOUNCE[status]}
      </span>
    </span>
  );
}

/** Classes du conteneur du champ : il « respire » tant que l’enregistrement est en cours. */
export function autosaveFieldClassName(status: AutosaveStatus) {
  return status === "saving" || status === "waiting" ? "field-saving" : undefined;
}

/** Fine barre qui coulisse sous le champ pendant l’enregistrement. */
export function AutosaveFieldProgress({ status }: { status: AutosaveStatus }) {
  const active = status === "saving" || status === "waiting";
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-x-0 bottom-0 h-0.5 overflow-hidden rounded-b-md transition-opacity duration-200",
        active ? "opacity-100" : "opacity-0",
      )}
    >
      {status === "saving" && (
        <span className="loading-bar block h-full w-1/3 rounded-full bg-foreground/60" />
      )}
    </span>
  );
}
