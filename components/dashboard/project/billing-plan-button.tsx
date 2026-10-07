"use client";
import { useState } from "react";
import { Loader2, RefreshCw, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { openProjectBillingPortal } from "@/app/actions/project-settings";
export function BillingPlanButton({
  projectId,
  intent,
  disabled = false,
  size = "default",
}: {
  projectId: string;
  intent: "renew" | "upgrade";
  disabled?: boolean;
  size?: "default" | "sm";
}) {
  const [busy, setBusy] = useState(false);
  async function open() {
    if (busy) return;
    setBusy(true);
    try {
      const result = await openProjectBillingPortal(projectId, intent);
      if (result.success) window.location.assign(result.url);
      else toast.error(result.error);
    } catch {
      toast.error(
        "La facturation est indisponible. Réessayez dans quelques instants.",
      );
    } finally {
      setBusy(false);
    }
  }
  const Icon = busy ? Loader2 : intent === "renew" ? RefreshCw : ArrowUpRight;
  return (
    <Button
      size={size}
      variant={intent === "renew" ? "default" : "outline"}
      className="h-auto min-h-9 whitespace-normal text-center"
      disabled={disabled || busy}
      aria-busy={busy}
      onClick={() => void open()}
    >
      <Icon
        aria-hidden="true"
        className={busy ? "size-4 animate-spin" : "size-4"}
      />
      {intent === "renew" ? "Renouveler le plan" : "Changer d’offre"}
    </Button>
  );
}

export function BillingPlanMenuItem({
  projectId,
  intent,
}: {
  projectId: string;
  intent: "renew" | "upgrade";
}) {
  const [busy, setBusy] = useState(false);
  return (
    <DropdownMenuItem
      disabled={busy}
      onSelect={(event) => {
        event.preventDefault();
        setBusy(true);
        void openProjectBillingPortal(projectId, intent)
          .then((result) => {
            if (result.success) window.location.assign(result.url);
            else toast.error(result.error);
          })
          .catch(() =>
            toast.error("La facturation est indisponible. Réessayez."),
          )
          .finally(() => setBusy(false));
      }}
    >
      {busy ? (
        <Loader2 className="size-4 animate-spin" />
      ) : intent === "renew" ? (
        <RefreshCw className="size-4" />
      ) : (
        <ArrowUpRight className="size-4" />
      )}
      {intent === "renew" ? "Renouveler le plan" : "Changer d’offre"}
    </DropdownMenuItem>
  );
}
