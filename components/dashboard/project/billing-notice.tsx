"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import useSWR from "swr";
import { useEffect } from "react";
import { AlertCircle, ArrowUpRight, LogIn } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { type billingAccess } from "@/lib/billing-access";
import { TRIAL_DAYS } from "@/lib/pricing";

import { LocalBillingDate } from "./local-billing-date";
import { BillingPlanButton } from "./billing-plan-button";

type Access = ReturnType<typeof billingAccess> & {
  /** Absent pour les rôles qui ne voient pas la facturation. */
  usage?: { used: number; limit: number } | null;
};
class StatusError extends Error {
  constructor(readonly status: number) {
    super("BILLING_STATUS_UNAVAILABLE");
  }
}
async function fetchStatus(url: string): Promise<Access> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new StatusError(response.status);
  return response.json();
}
const titles = {
  active: "Automatisation en pause",
  trialing: "Essai",
  trial_expired: "Essai terminé",
  payment_pending: "Confirmation du paiement en attente",
  payment_failed: "Paiement à régulariser",
  inactive: "Abonnement suspendu ou terminé",
};

/** Publie la hauteur du bandeau : la messagerie occupe exactement le reste de l’écran. */
function trackNoticeHeight(notice: HTMLElement | null) {
  if (!notice) return;
  const root = document.documentElement;
  const update = () => {
    const margin = Number.parseFloat(getComputedStyle(notice).marginTop) || 0;
    root.style.setProperty(
      "--billing-notice-height",
      `${notice.getBoundingClientRect().height + margin}px`,
    );
  };
  const observer = new ResizeObserver(update);
  observer.observe(notice);
  update();
  return () => {
    observer.disconnect();
    root.style.removeProperty("--billing-notice-height");
  };
}

export function BillingNotice({
  projectId,
  initial,
  canViewBilling,
  canManageBilling,
  needsCheckout = false,
}: {
  projectId: string;
  initial: Access;
  canViewBilling: boolean;
  canManageBilling: boolean;
  needsCheckout?: boolean;
}) {
  const pathname = usePathname();
  const {
    data = initial,
    error,
    mutate,
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
  // Session expirée : l'état affiché n'est plus fiable et toute action
  // échouerait. On le dit tel quel plutôt qu'un « état à vérifier ».
  const signedOut = error instanceof StatusError && error.status === 401;
  // Un échec ponctuel ne dit rien de l'abonnement : le dernier état connu
  // reste affiché (ou rien s'il était normal) et SWR réessaie seul.
  if (data.reason === "active" && !data.automationPaused && !signedOut) return null;
  const blocked = !signedOut && !data.allowed;
  const title = signedOut
    ? "Session expirée"
    : needsCheckout
      ? "Paiement à finaliser"
      : titles[data.reason];
  const detail = signedOut
    ? "Reconnectez-vous pour continuer."
    : needsCheckout
      ? `Le paiement n’a pas abouti lors de la création du projet. Reprenez-le pour activer l’essai de ${TRIAL_DAYS} jours.`
      : data.reason === "active" && data.automationPaused
        ? "Votre abonnement reste actif ; les réponses automatiques sont en pause."
        : data.reason === "trialing"
          ? null
          : data.message;
  const stale = !!error && !signedOut;

  const usage = data.allowed && !signedOut ? data.usage : null;
  const limit = Math.max(1, usage?.limit ?? 1);
  const ratio = Math.min(1, (usage?.used ?? 0) / limit);
  // Petits écrans : rien à décider ici, le quota suffit et mène à la facturation.
  const compact = !!usage && canViewBilling && !blocked && !detail && !error;
  const quota = usage && (
    <>
      <div
        role="progressbar"
        aria-label="Consommation du quota de messages"
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={Math.min(usage.used, limit)}
        className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn(
            "h-full rounded-full motion-safe:transition-[width] motion-safe:duration-500",
            ratio >= 0.9 ? "bg-destructive" : "bg-foreground",
          )}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
      <p className="shrink-0 text-xs text-muted-foreground tabular-nums">
        <span className="text-foreground">{usage.used.toLocaleString("fr-FR")}</span>
        {" / "}
        {usage.limit.toLocaleString("fr-FR")}{" "}
        {/* Abrégé sur mobile ; les lecteurs d’écran entendent toujours « messages ». */}
        <span aria-hidden="true" className="sm:hidden">msg</span>
        <span className="max-sm:sr-only">messages</span>
      </p>
    </>
  );

  return (
    <aside
      ref={trackNoticeHeight}
      aria-label="État de l’abonnement"
      className={cn(
        "mx-4 mt-3 rounded-xl border px-3 py-1.5 sm:mx-6 xl:mx-8",
        blocked ? "border-destructive/30 bg-destructive/5" : "bg-card",
        compact && "max-lg:mt-2 max-lg:border-0 max-lg:bg-transparent max-lg:p-0",
      )}
    >
      {compact && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href={`/projects/${projectId}/billing`}
              className="flex h-9 items-center gap-3 rounded-xl border bg-card px-3 outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 lg:hidden"
            >
              <span className="sr-only">
                {title}
                {data.endsAt && (
                  <>
                    {" jusqu’au "}
                    <LocalBillingDate value={data.endsAt} dateOnly />
                  </>
                )}
                . Ouvrir la facturation.
              </span>
              {quota}
              <ArrowUpRight aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
            </Link>
          </TooltipTrigger>
          <TooltipContent collisionPadding={16} className="max-w-[min(15rem,calc(100vw-2rem))]">
            {/* Le contenu de l’infobulle est en flex : le texte doit rester d’un seul bloc. */}
            <span className="block">
              <span className="block font-medium">
                {title}
                {data.endsAt && (
                  <>
                    {" jusqu’au "}
                    <LocalBillingDate value={data.endsAt} dateOnly />
                  </>
                )}
              </span>
              <span className="block opacity-70">Messages utilisés sur votre quota</span>
            </span>
          </TooltipContent>
        </Tooltip>
      )}
      {/* Texte à gauche sur toute la place libre ; quota de largeur fixe et
          action à droite, sans jamais se chevaucher. Mobile : texte, puis
          quota et action sur une ligne. */}
      <div
        className={cn(
          "flex flex-col gap-2 py-0.5 sm:flex-row sm:items-center sm:gap-4",
          compact && "max-lg:hidden",
        )}
      >
        <div className="min-w-0 flex-1 text-sm" role="status" aria-live="polite">
          <p className="flex min-w-0 items-center gap-1.5 font-medium">
            {blocked && (
              <AlertCircle aria-hidden="true" className="size-4 shrink-0 text-destructive" />
            )}
            <span className="min-w-0">
              {title}
              {data.endsAt && !signedOut && (
                <span className="font-normal text-muted-foreground">
                  {" "}
                  · <span className="max-sm:hidden">{data.reason === "trialing" ? "jusqu’au " : "échéance le "}</span>
                  <LocalBillingDate value={data.endsAt} dateOnly />
                </span>
              )}
            </span>
          </p>
          {detail && <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>}
          {!canViewBilling && blocked && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Contactez le propriétaire du projet pour régulariser l’abonnement.
            </p>
          )}
          {stale && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Dernier état connu : mise à jour impossible pour l’instant.
            </p>
          )}
        </div>
        {(usage || signedOut || canViewBilling || canManageBilling) && (
          <div className="flex min-w-0 items-center gap-3 sm:shrink-0">
            {usage && (
              <div className="flex min-w-0 flex-1 items-center gap-3 sm:w-56 sm:flex-none lg:w-80 xl:w-96">
                {quota}
              </div>
            )}
            <div className="ml-auto flex shrink-0 gap-2">
              {signedOut ? (
                <Button size="sm" asChild>
                  <Link href={`/sign-in?${new URLSearchParams({ callbackUrl: pathname }).toString()}`}>
                    <LogIn data-icon="inline-start" />
                    Se reconnecter
                  </Link>
                </Button>
              ) : blocked && canManageBilling ? (
                <BillingPlanButton
                  projectId={projectId}
                  intent="renew"
                  size="sm"
                  needsCheckout={needsCheckout}
                />
              ) : (
                canViewBilling &&
                // Déjà sur la facturation : le lien n'y mènerait nulle part.
                pathname !== `/projects/${projectId}/billing` && (
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/projects/${projectId}/billing`} aria-label="Facturation">
                      <span className="hidden sm:inline">Facturation</span>
                      <ArrowUpRight data-icon="inline-end" />
                    </Link>
                  </Button>
                )
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
