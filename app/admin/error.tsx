"use client";

import { CircleAlert, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminDashboardError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div role="alert" className="w-full max-w-md rounded-2xl border bg-card p-6 text-center shadow-sm">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-muted">
          <CircleAlert aria-hidden="true" className="size-5 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold tracking-tight">Tableau de bord indisponible</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Impossible de calculer les indicateurs pour le moment. Réessayez dans quelques instants.
        </p>
        {error.digest && (
          <p className="mt-2 font-mono text-xs text-muted-foreground">Référence : {error.digest}</p>
        )}
        <Button type="button" onClick={() => retry()} className="mt-5">
          <RotateCcw data-icon="inline-start" />
          Réessayer
        </Button>
      </div>
    </div>
  );
}
