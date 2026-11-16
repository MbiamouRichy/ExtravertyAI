"use client";
import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { buyMessageCredit } from "@/app/actions/billing-plan";
import { cn } from "@/lib/utils";

/**
 * Ouvre le paiement Polar d'une recharge. Le serveur revérifie tout (droits,
 * abonnement payé, plafond, prix) ; le crédit n'arrive qu'avec le webhook.
 */
export function MessageCreditButton({
  projectId,
  label,
  disabled = false,
  className,
}: {
  projectId: string;
  label: string;
  disabled?: boolean;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  async function open() {
    if (busy) return;
    setBusy(true);
    try {
      const result = await buyMessageCredit(projectId);
      if (result.success) {
        window.location.assign(result.url);
        return;
      }
      toast.error(result.error);
    } catch {
      toast.error("Le service de paiement est indisponible. Réessayez dans un instant.");
    }
    setBusy(false);
  }
  return (
    <Button
      className={cn("h-auto min-h-10 w-full whitespace-normal", className)}
      disabled={disabled || busy}
      aria-busy={busy}
      onClick={() => void open()}
    >
      {busy ? (
        <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
      ) : (
        <Plus aria-hidden="true" className="size-4" />
      )}
      {label}
    </Button>
  );
}
