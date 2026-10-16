"use client";
import { useState } from "react";
import { ArrowUpRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { openProjectBillingPortal } from "@/app/actions/project-settings";
import { BillingPlanButton } from "./billing-plan-button";
export function BillingActions({
  projectId,
  canManage,
  configured,
}: {
  projectId: string;
  canManage: boolean;
  configured: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function openPortal() {
    setBusy(true);
    setError("");
    try {
      const result = await openProjectBillingPortal(projectId);
      if (result.success) window.location.assign(result.url);
      else setError(result.error);
    } catch {
      setError("Le portail est temporairement indisponible. Réessayez.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="min-w-0 space-y-3">
      <div className="grid grid-cols-2 gap-2 *:first:col-span-2 sm:flex sm:flex-wrap sm:*:first:col-span-1">
        {canManage && (
          <>
            <BillingPlanButton
              projectId={projectId}
              intent="renew"
              disabled={!configured}
            />
            <BillingPlanButton
              projectId={projectId}
              intent="upgrade"
              disabled={!configured}
            />
          </>
        )}
        {canManage && (
          <Button
            variant="outline"
            className="h-auto min-h-9 whitespace-normal text-center"
            disabled={busy || !configured}
            onClick={() => void openPortal()}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <ArrowUpRight className="size-4" aria-hidden="true" />
            )}
            Gérer l’abonnement
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="max-w-md text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
