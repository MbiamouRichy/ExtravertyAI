import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Smartphone,
  FolderOpen,
  Settings,
  CreditCardIcon,
} from "lucide-react";
import Link from "next/link";
import { ProjectsTable } from "./dataTable";
import { ProjectsTableColumns } from "./columnTable";
import { WhatsAppConnectionStatus } from "./whatsapp-connection-status";
import { Card } from "@/components/ui/card";
import { billingAccessLabel, type billingAccess } from "@/lib/billing-access";

import { LocalBillingDate } from "./local-billing-date";
import { BillingPlanButton } from "./billing-plan-button";

const statusConfig: Record<
  string,
  {
    label: string;
    variant: "default" | "secondary" | "outline" | "destructive";
  }
> = {
  active: { label: "Actif", variant: "default" },
  trialing: { label: "En essai", variant: "secondary" },
  paused: { label: "En pause", variant: "outline" },
  inactive: { label: "Inactif", variant: "destructive" },
};
export interface CustomProjectProps {
  projects: {
    id: string;
    canManageBilling?: boolean;
    name: string;
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

export default function HomeProjectsPage({ projects }: CustomProjectProps) {
  return (
    <div className="mx-auto flex w-full min-w-0 max-w-7xl flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
      {/* En-tête de page (Responsive) */}
      <div className="flex min-w-0 flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="space-y-1.5">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
            Vos projets
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Gérez vos projets et consultez le dernier état connu de leur
            connexion WhatsApp.
          </p>
        </div>
        <Button asChild className="w-full sm:w-auto shrink-0 shadow-sm">
          <Link href="/projects/new" title="Créer un projet">
            <Plus className="mr-2 h-4 w-4" />
            Nouveau projet
          </Link>
        </Button>
      </div>

      {projects.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card p-8 md:p-14 text-center shadow-sm animate-in fade-in-50 duration-500">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary mb-5">
            <FolderOpen className="h-6 w-6 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-2">
            Aucun projet actif
          </h2>
          <p className="text-sm text-muted-foreground max-w-sm mb-6">
            Créez votre premier projet pour générer une instance API et
            commencer à automatiser vos communications.
          </p>
          <Button asChild variant="default" className="w-full sm:w-auto">
            <Link href="/projects/new" title="Créer un projet">
              <Plus className="sm:mr-2 h-4 w-4" />
              Créer mon premier projet
            </Link>
          </Button>
        </div>
      ) : (
        <div className="min-w-0 w-full">
          {/* VUE MOBILE : Affichage en Cartes */}
          <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:hidden">
            {projects.map((project) => {
              const statusInfo = project.billingAccess
                ? {
                    label: billingAccessLabel(project.billingAccess),
                    variant: project.billingAccess.allowed
                      ? ("secondary" as const)
                      : ("destructive" as const),
                  }
                : statusConfig[project.status] || {
                    label: "Inconnu",
                    variant: "outline",
                  };
              return (
                <Card
                  key={project.id}
                  className="flex flex-col p-4 border bg-card shadow-sm space-y-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <Link
                      href={`/projects/${project.id}`}
                      title={project.name}
                      className="min-w-0 break-words font-semibold text-base text-foreground"
                    >
                      {project.name}
                    </Link>
                    <Badge
                      variant={statusInfo.variant}
                      className="font-normal shrink-0"
                    >
                      {statusInfo.label}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 gap-3 text-sm">
                    <div className="flex gap-3 text-muted-foreground items-center">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
                        <Smartphone className="h-4 w-4 text-foreground" />
                      </div>
                      <span className="font-mono tracking-tight text-foreground">
                        {project.numero}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 bg-muted/50 p-2 rounded-lg">
                      <div className="flex items-center gap-2">
                        <CreditCardIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs font-mono text-muted-foreground truncate max-w-30">
                          {project.plan}
                        </span>
                      </div>
                      <WhatsAppConnectionStatus
                        status={project.instanceStatus}
                      />
                    </div>

                    <p className="font-mono text-xs text-muted-foreground mt-1">
                      Expire le :{" "}
                      <span className="text-foreground font-medium">
                        {project.stripeCurrentPeriodEnd || project.expiredAt ? (
                          <LocalBillingDate
                            value={
                              project.stripeCurrentPeriodEnd ||
                              project.expiredAt
                            }
                          />
                        ) : (
                          "Non défini"
                        )}
                      </span>
                    </p>
                    <div className="grid grid-cols-2 gap-2 mt-2 pt-3 border-t border-border/50">
                      <Button
                        asChild
                        variant="outline"
                        className="w-full"
                        size="sm"
                      >
                        <Link
                          href={`/projects/${project.id}`}
                          title={`Ouvrir ${project.name}`}
                        >
                          Ouvrir
                        </Link>
                      </Button>
                      <Button
                        asChild
                        className="w-full"
                        variant="outline"
                        size="sm"
                      >
                        <Link
                          href={`/projects/${project.id}/settings`}
                          title={`Gerer ${project.name}`}
                        >
                          <Settings className="h-4 w-4 mr-2" />
                          Paramètres
                        </Link>
                      </Button>
                    </div>
                    {project.canManageBilling && (
                      <div className="grid gap-2">
                        <BillingPlanButton
                          projectId={project.id}
                          intent="renew"
                          size="sm"
                        />
                        <BillingPlanButton
                          projectId={project.id}
                          intent="upgrade"
                          size="sm"
                        />
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>

          {/* VUE DESKTOP : DataTable ShadcnUI */}
          <div className="hidden w-full min-w-0 xl:block">
            <ProjectsTable columns={ProjectsTableColumns} data={projects} />
          </div>
        </div>
      )}
    </div>
  );
}
