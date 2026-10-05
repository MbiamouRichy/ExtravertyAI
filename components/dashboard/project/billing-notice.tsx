"use client";

import Link from "next/link";
import useSWR from "swr";
import { useEffect } from "react";
import { AlertCircle, CalendarClock, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBillingDate, type billingAccess } from "@/lib/billing-access";

type Access = ReturnType<typeof billingAccess>;
async function fetchStatus(url: string): Promise<Access> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error("BILLING_STATUS_UNAVAILABLE");
  return response.json();
}
const titles = {
  active: "Automatisation en pause",
  trialing: "Période d’essai",
  trial_expired: "Essai terminé",
  payment_pending: "Confirmation du paiement en attente",
  payment_failed: "Paiement à régulariser",
  inactive: "Abonnement suspendu ou terminé",
};

export function BillingNotice({
  projectId,
  initial,
  canViewBilling,
}: {
  projectId: string;
  initial: Access;
  canViewBilling: boolean;
}) {
  const {
    data = initial,
    error,
    mutate,
    isValidating,
  } = useSWR<Access>(
    `/api/projects/${encodeURIComponent(projectId)}/billing-status`,
    fetchStatus,
    { fallbackData: initial, refreshInterval: 30000, revalidateOnFocus: true },
  );
  // Layouts persist across navigation: refresh at the deadline as well as polling.
  useEffect(() => {
    if (!data.allowed || !data.endsAt) return;
    const remaining = new Date(data.endsAt).getTime() - Date.now();
    if (remaining <= 0 || remaining > 2147483646) return;
    const timer = setTimeout(() => void mutate(), remaining + 100);
    return () => clearTimeout(timer);
  }, [data.allowed, data.endsAt, mutate]);
  if (data.reason === "active" && !data.automationPaused && !error) return null;
  return (
    <aside
      aria-label="État de l’abonnement"
      className="mx-4 mt-4 rounded-lg border bg-muted/40 p-4 sm:mx-8"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div
          className="flex min-w-0 items-start gap-3"
          role="status"
          aria-live="polite"
        >
          {data.allowed ? (
            <CalendarClock
              aria-hidden="true"
              className="mt-0.5 size-5 shrink-0 text-muted-foreground"
            />
          ) : (
            <AlertCircle
              aria-hidden="true"
              className="mt-0.5 size-5 shrink-0 text-destructive"
            />
          )}
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-semibold">
              {error && data.reason === "active" && !data.automationPaused
                ? "État de l’abonnement à vérifier"
                : titles[data.reason]}
            </p>
            <p className="text-sm text-muted-foreground">
              {data.reason === "active" && data.automationPaused
                ? "Votre abonnement reste actif. Vous avez mis les réponses automatiques en pause."
                : data.message}
            </p>
            {data.endsAt && (
              <p className="text-xs text-muted-foreground">
                {data.reason === "trialing"
                  ? "Fin de l’essai"
                  : "Échéance de la période"}{" "}
                : {formatBillingDate(data.endsAt)}
              </p>
            )}
            {!canViewBilling && !data.allowed && (
              <p className="text-xs text-muted-foreground">
                Contactez le propriétaire du projet pour régulariser
                l’abonnement.
              </p>
            )}
            {error && (
              <p className="text-xs text-destructive">
                L’actualisation est indisponible. Réessayez dans quelques
                instants.
              </p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {canViewBilling && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/projects/${projectId}/billing`}>
                Consulter la facturation
              </Link>
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            disabled={isValidating}
            onClick={() => void mutate()}
          >
            <RefreshCw
              aria-hidden="true"
              className={isValidating ? "size-4 animate-spin" : "size-4"}
            />{" "}
            Actualiser
          </Button>
        </div>
      </div>
    </aside>
  );
}
