import { CheckCheck } from "lucide-react";

import { getInitials } from "@/components/getInitials";

/**
 * Aperçu en direct : ce que verra un client qui écrit au numéro du projet.
 * Il se met à jour pendant la saisie pour rendre le résultat concret.
 */
export function AssistantPreview({
  projectName,
  phone,
  planName,
}: {
  projectName: string;
  phone?: string;
  planName: string;
}) {
  const name = projectName || "Votre entreprise";

  return (
    <figure className="overflow-hidden rounded-xl border bg-card">
      <figcaption className="flex items-center justify-between gap-3 border-b px-4 py-2.5 text-xs text-muted-foreground">
        Aperçu côté client
        <span className="rounded-full border px-2 py-0.5">Forfait {planName}</span>
      </figcaption>

      <div className="flex items-center gap-3 border-b bg-muted/40 px-4 py-3">
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background"
        >
          {getInitials(name)}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{name}</span>
          <span className="block truncate text-xs text-muted-foreground tabular-nums">
            {phone ?? "Numéro WhatsApp"} · répond instantanément
          </span>
        </span>
      </div>

      <div aria-hidden className="space-y-3 px-4 py-5 text-sm">
        <p className="mr-10 w-fit rounded-2xl rounded-tl-sm bg-muted px-3.5 py-2">
          Bonjour, est-ce que vous livrez ce week-end ?
        </p>
        <div className="ml-10 flex flex-col items-end">
          <p className="w-fit rounded-2xl rounded-tr-sm bg-foreground px-3.5 py-2 text-background">
            Bonjour ! Ici l’assistant de {name}. Oui, nous livrons samedi et
            dimanche. Souhaitez-vous que je réserve un créneau ?
          </p>
          <span className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
            Réponse IA · 3 s
            <CheckCheck className="size-3.5" />
          </span>
        </div>
      </div>
      <p className="sr-only">
        Exemple : un client demande une livraison et l’assistant de {name}{" "}
        répond en quelques secondes.
      </p>
    </figure>
  );
}
