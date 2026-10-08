import { Check, Loader2 } from "lucide-react";
import type { AutosaveStatus as Status } from "@/lib/autosave-queue";

export function AutosaveStatus({
  status,
  error,
}: {
  status: Status;
  error?: string;
}) {
  return (
    <p
      role="status"
      aria-live="polite"
      className={`flex items-center gap-2 text-xs ${status === "error" || status === "invalid" ? "text-destructive" : "text-muted-foreground"}`}
    >
      {status === "saving" && (
        <Loader2
          aria-hidden="true"
          className="size-4 animate-spin motion-reduce:animate-none"
        />
      )}
      {status === "saved" && <Check aria-hidden="true" className="size-4" />}
      {status === "error"
        ? error
        : status === "invalid"
          ? "Complétez les champs indiqués pour enregistrer."
          : status === "saving"
            ? "Enregistrement…"
            : status === "waiting"
              ? "Modifications en attente…"
              : status === "saved"
                ? "Toutes les modifications sont enregistrées."
                : "Enregistrement automatique activé."}
    </p>
  );
}
