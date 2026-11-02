"use client";
import { useState } from "react";
import { ArrowDownToLine, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { openProjectInvoice } from "@/app/actions/project-settings";

export function BillingInvoiceButton({
  projectId,
  orderId,
  label,
}: {
  projectId: string;
  orderId: string;
  label: string;
}) {
  const [busy, setBusy] = useState(false);
  async function open() {
    setBusy(true);
    try {
      const result = await openProjectInvoice(projectId, orderId);
      if (result.success) window.location.assign(result.url);
      else toast.error(result.error);
    } catch {
      toast.error("La facture est indisponible. Réessayez dans quelques instants.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={busy}
      aria-busy={busy}
      aria-label={label}
      onClick={() => void open()}
    >
      {busy ? (
        <Loader2 data-icon="inline-start" className="animate-spin" />
      ) : (
        <ArrowDownToLine data-icon="inline-start" />
      )}
      PDF
    </Button>
  );
}
