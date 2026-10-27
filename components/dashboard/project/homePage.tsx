import Link from "next/link";
import {
  ArrowUpRight,
  CreditCard,
  Ellipsis,
  FolderOpen,
  MessagesSquare,
  Plus,
  Settings,
  Smartphone,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { billingAccessLabel, type billingAccess } from "@/lib/billing-access";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { WhatsAppConnectionStatus } from "./whatsapp-connection-status";
import { LocalBillingDate } from "./local-billing-date";
import { BillingPlanButton, BillingPlanMenuItem } from "./billing-plan-button";
import { ProjectIcon } from "./project-icon";

const statusLabel: Record<string, string> = {
  active: "Actif",
  trialing: "En essai",
  paused: "En pause",
  inactive: "Inactif",
};

export interface CustomProjectProps {
  projects: {
    id: string;
    canManageBilling?: boolean;
    needsCheckout?: boolean;
    name: string;
    logoUrl?: string | null;
    numero: string;
    status: string;
    billingAccess?: ReturnType<typeof billingAccess>;
    plan: string;
    messageCount: number;
    allMessagesCount: number;
    expiredAt: Date | null;
    instanceStatus: string | null;
    stripeCurrentPeriodEnd: Date | null;
  }[];
}

const number = new Intl.NumberFormat("fr-FR");

function Quota({ used, limit }: { used: number; limit: number }) {
  const ratio = limit > 0 ? Math.min(1, used / limit) : 0;
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-xs">
        <span className="text-muted-foreground">Messages utilisés</span>
        <span className="font-mono tabular-nums">
          {number.format(used)}
          <span className="text-muted-foreground"> / {limit > 0 ? number.format(limit) : "—"}</span>
        </span>
      </div>
      <div
        role="progressbar"
        aria-label="Quota de messages"
        aria-valuemin={0}
        aria-valuemax={limit || 1}
        aria-valuenow={Math.min(used, limit || used)}
        className="h-1.5 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn("h-full rounded-full", ratio >= 0.9 ? "bg-destructive" : "bg-foreground")}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
      {ratio >= 0.9 && (
        <p className="mt-1.5 text-xs text-destructive">Quota presque atteint</p>
      )}
    </div>
  );
}

export default function HomeProjectsPage({ projects }: CustomProjectProps) {
  const connected = projects.filter((project) => project.instanceStatus === "connected").length;
  const usedMessages = projects.reduce((sum, project) => sum + (project.messageCount || 0), 0);

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-7xl flex-1 flex-col gap-8 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Espace de travail</p>
          <h1 className="mt-1 text-3xl md:text-4xl">Vos projets</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Chaque projet correspond à un numéro WhatsApp et à son assistant IA.
          </p>
        </div>
        <Button asChild className="w-full sm:w-auto">
          <Link href="/projects/new">
            <Plus data-icon="inline-start" />
            Nouveau projet
          </Link>
        </Button>
      </header>

      {projects.length === 0 ? (
        <section
          aria-labelledby="empty-title"
          className="relative isolate flex flex-col items-center overflow-hidden rounded-3xl border border-dashed px-6 py-16 text-center"
        >
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-[radial-gradient(var(--border)_1px,transparent_1px)] mask-[radial-gradient(ellipse_at_center,black,transparent_70%)] bg-size-[18px_18px]"
          />
          <span className="flex size-14 items-center justify-center rounded-2xl border bg-background shadow-sm">
            <FolderOpen aria-hidden="true" className="size-6" />
          </span>
          <h2 id="empty-title" className="mt-5 text-2xl tracking-tight">
            Créez votre premier projet
          </h2>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Connectez un numéro WhatsApp, instruisez votre assistant et laissez-le
            répondre à vos clients. Comptez environ 5 minutes.
          </p>
          <Button asChild size="lg" className="mt-6">
            <Link href="/projects/new">
              <Plus data-icon="inline-start" />
              Créer un projet
            </Link>
          </Button>
        </section>
      ) : (
        <>
          <dl className="grid grid-cols-3 divide-x rounded-2xl border bg-card">
            {[
              { label: "Projets", long: "Projets", value: number.format(projects.length) },
              { label: "Connectés", long: "WhatsApp connectés", value: `${connected}/${projects.length}` },
              { label: "Envoyés", long: "Messages envoyés", value: number.format(usedMessages) },
            ].map((item) => (
              <div key={item.long} className="min-w-0 px-3 py-4 sm:px-6">
                <dt className="truncate whitespace-nowrap text-xs text-muted-foreground">
                  <span className="sm:hidden">{item.label}</span>
                  <span className="hidden sm:inline">{item.long}</span>
                </dt>
                <dd className="mt-1 truncate font-heading text-xl font-bold tabular-nums sm:text-2xl">{item.value}</dd>
              </div>
            ))}
          </dl>

          <ul className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => {
              const status = project.billingAccess
                ? {
                    label: project.needsCheckout
                      ? "Paiement à finaliser"
                      : billingAccessLabel(project.billingAccess),
                    ok: project.billingAccess.allowed,
                  }
                : { label: statusLabel[project.status] ?? "Inconnu", ok: project.status !== "inactive" };
              const renewal = project.stripeCurrentPeriodEnd || project.expiredAt;

              return (
                <li
                  key={project.id}
                  className="group @container/card relative flex min-w-0 flex-col rounded-2xl border bg-card transition-shadow focus-within:ring-3 focus-within:ring-ring/50 hover:shadow-lg hover:shadow-foreground/5"
                >
                  <div className="flex min-w-0 items-start justify-between gap-3 p-4 pb-4 sm:p-5">
                    <div className="flex min-w-0 items-center gap-3">
                      <ProjectIcon name={project.name} logoUrl={project.logoUrl} />
                      <div className="min-w-0">
                        <h2 className="truncate font-heading text-base font-semibold tracking-tight">
                          <Link
                            href={`/projects/${project.id}`}
                            className="outline-none after:absolute after:inset-0 after:rounded-2xl"
                          >
                            {project.name}
                          </Link>
                        </h2>
                        <p className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                          <Smartphone aria-hidden="true" className="size-3" />
                          {project.numero || "Numéro à connecter"}
                        </p>
                      </div>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full border px-2 py-0.5 text-[11px]",
                        status.ok ? "text-muted-foreground" : "border-destructive/40 text-destructive",
                      )}
                    >
                      {status.label}
                    </span>
                  </div>

                  <div className="min-w-0 space-y-4 px-4 pb-5 sm:px-5">
                    <WhatsAppConnectionStatus status={project.instanceStatus} />
                    <Quota used={project.messageCount || 0} limit={project.allMessagesCount || 0} />
                  </div>

                  {/* Carte étroite : offre et échéance en haut, actions en dessous. */}
                  <div className="mt-auto flex min-w-0 flex-col gap-3 border-t px-4 py-3 text-xs text-muted-foreground sm:px-5 @md/card:flex-row @md/card:items-center @md/card:justify-between @md/card:gap-2">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <CreditCard aria-hidden="true" className="size-3.5 shrink-0" />
                      <span className="shrink-0 font-medium capitalize text-foreground">{project.plan}</span>
                      {renewal && (
                        <span className="min-w-0 truncate">
                          <span aria-hidden="true">· </span>
                          jusqu’au <LocalBillingDate value={renewal} dateOnly />
                        </span>
                      )}
                    </span>
                    <div className="relative z-10 flex shrink-0 items-center justify-end gap-1">
                      {/* Renouvellement visible : réservé au propriétaire (vérifié par le serveur). */}
                      {project.canManageBilling && (
                        <BillingPlanButton
                          projectId={project.id}
                          intent="renew"
                          size="sm"
                          variant="outline"
                          label="Renouveler"
                          needsCheckout={project.needsCheckout}
                          className="mr-1 min-h-8 flex-1 text-xs @md/card:flex-none"
                        />
                      )}
                      <Button asChild variant="ghost" size="icon-sm">
                        <Link href={`/projects/${project.id}/chat`} aria-label={`Messagerie de ${project.name}`}>
                          <MessagesSquare />
                        </Link>
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" aria-label={`Plus d’actions pour ${project.name}`}>
                            <Ellipsis />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuItem asChild>
                            <Link href={`/projects/${project.id}`}>
                              <ArrowUpRight />
                              Ouvrir le tableau de bord
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/projects/${project.id}/settings`}>
                              <Settings />
                              Paramètres
                            </Link>
                          </DropdownMenuItem>
                          {project.canManageBilling && !project.needsCheckout && (
                            <>
                              <DropdownMenuSeparator />
                              <BillingPlanMenuItem projectId={project.id} intent="upgrade" />
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </li>
              );
            })}
            <li>
              <Link
                href="/projects/new"
                className="flex h-full min-h-56 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground outline-none transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="flex size-10 items-center justify-center rounded-xl border bg-background">
                  <Plus aria-hidden="true" className="size-5" />
                </span>
                Nouveau projet
              </Link>
            </li>
          </ul>
        </>
      )}
    </div>
  );
}
