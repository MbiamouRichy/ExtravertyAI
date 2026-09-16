"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { openProjectBillingPortal } from "@/app/actions/project-settings";
export function BillingActions({
  projectId,
  canManage,
  configured,
}: {
  projectId: string;
  canManage: boolean;
  configured: boolean;
}) {
  const router = useRouter();
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
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {canManage && (
          <Button
            disabled={busy || !configured}
            onClick={() => void openPortal()}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ArrowUpRight className="size-4" />
            )}{" "}
            Gérer mon abonnement
          </Button>
        )}
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => router.refresh()}
        >
          <RefreshCw className="size-4" /> Actualiser
        </Button>
      </div>
      {error && (
        <p role="alert" className="max-w-md text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
