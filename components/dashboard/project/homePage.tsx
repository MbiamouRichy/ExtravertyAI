import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Smartphone, FolderOpen, Server, Settings } from "lucide-react"
import { Project } from "@/src/generated/prisma/client"
import Link from "next/link"
import { ProjectsTable } from "./dataTable"
import { ProjectsTableColumns } from "./columnTable"

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  active: { label: "Actif", variant: "default" },
  trialing: { label: "En essai", variant: "secondary" },
  paused: { label: "En pause", variant: "outline" },
  inactive: { label: "Inactif", variant: "destructive" }
};
interface HomeProjectsPageProps {
  projects: Project[]
}

export default function HomeProjectsPage({ projects }: HomeProjectsPageProps) {
  return (
    <div className="flex w-full flex-col mx-auto max-w-7xl space-y-6 md:space-y-8 p-4 sm:p-6 md:p-8">

      {/* En-tête de page (Responsive) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
            Projets
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Gérez vos flux d&apos;automatisation et surveillez l&apos;état de vos instances en temps réel.
          </p>
        </div>
        <Button asChild className="w-full md:w-auto shrink-0 shadow-sm">
          <Link href="/dashboard/projects/new" title="Créer un projet">
            <Plus className="mr-2 h-4 w-4" />
            Nouveau projet
          </Link>
        </Button>
      </div>

      {projects.length === 0 ?
        (
          /* Empty State */
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card p-8 md:p-14 text-center shadow-sm animate-in fade-in-50 duration-500">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary mb-5">
              <FolderOpen className="h-6 w-6 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-2">
              Aucun projet actif
            </h2>
            <p className="text-sm text-muted-foreground max-w-sm mb-6">
              Créez votre premier projet pour générer une instance API et commencer à automatiser vos communications.
            </p>
            <Button asChild variant="default" className="w-full sm:w-auto">
              <Link href="/dashboard/projects/new" title="Créer un projet">
                <Plus className="mr-2 h-4 w-4" />
                Créer mon premier projet
              </Link>
            </Button>
          </div>
        ) : (
          <div className="animate-in fade-in duration-500">
            {/* VUE MOBILE : Affichage en Cartes */}
            <div className="grid grid-cols-1 gap-4 md:hidden">
              {projects.map((project) => {
                const statusInfo = statusConfig[project.status] || { label: "Inconnu", variant: "outline" };
                return (
                  <div
                    key={project.id}
                    className="flex flex-col p-5 rounded-xl border border-border bg-card shadow-sm space-y-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-base text-foreground truncate">
                        {project.name}
                      </h3>
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

                      <div className="flex items-center justify-between gap-2 bg-muted/50 p-2 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Server className="h-4 w-4 text-muted-foreground" />
                          <span className="text-xs font-mono text-muted-foreground truncate max-w-[120px]">
                            {project.instanceName}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {project.instanceStatus === "connected" ? (
                            <>
                              <div className="h-2 w-2 rounded-full bg-green-500 ring-2 ring-green-500/20" />
                              <span className="text-xs font-medium text-foreground">Connecté</span>
                            </>
                          ) : project.instanceStatus === "connecting" ? (
                            <>
                              <div className="h-2 w-2 rounded-full bg-yellow-500 ring-2 ring-yellow-500/20 animate-pulse" />
                              <span className="text-xs font-medium text-foreground">En cours</span>
                            </>
                          ) : (
                            <>
                              <div className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                              <span className="text-xs font-medium text-muted-foreground">Déconnecté</span>
                            </>
                          )}
                        </div>
                      </div>

                      <p className="font-mono text-xs text-muted-foreground mt-1">
                        Expire le : {" "}
                        <span className="text-foreground font-medium">
                          {project.stripeCurrentPeriodEnd || project.expiredAt
                            ? new Intl.DateTimeFormat("fr-FR", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric"
                            }).format(new Date((project.stripeCurrentPeriodEnd || project.expiredAt) as Date))
                            : "Non défini"}
                        </span>
                      </p>
                      <div className="grid grid-cols-2 gap-2 mt-2 pt-3 border-t border-border/50">
                        <Button className="w-full" size="sm">
                          Renouveler
                        </Button>
                        <Button className="w-full" variant="outline" size="sm">
                          <Settings className="h-4 w-4 mr-2" />
                          Gérer
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* VUE DESKTOP : DataTable ShadcnUI */}
            <div className="hidden md:block">
              <ProjectsTable columns={ProjectsTableColumns} data={projects} />
            </div>
          </div>
        )}
    </div>
  )
}