"use client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Plus, Smartphone, FolderOpen, Server, MoreHorizontal } from "lucide-react"
import { CreateProjectDialog } from "@/components/dashboard/project/createInstanceForm"
import { Project } from "@/src/generated/prisma/client"
import { useOptimistic } from "react"
import Link from "next/link"

export default function HomeProjectsPage({projects}:{projects: Project[]}) {
  const [optimisticProjects, addOptimisticProject] = useOptimistic(
    projects,
    (state, newProject: Project) => [...state, newProject]
  )

  return (
    <div className="flex flex-col space-y-6 md:space-y-8 p-4 sm:p-6 md:p-10 w-full max-w-300 mx-auto">
      {/* En-tête de page (Responsive) */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
            Projets
          </h1>
          <p className="text-sm text-muted-foreground max-w-3xl">
            Gérez vos flux d&apos;automatisation et surveillez l&apos;état de vos instances en temps réel.
          </p>
        </div>
        {/* Le bouton prend toute la largeur sur mobile, et s'ajuste sur desktop */}
        <CreateProjectDialog addOptimisticProject={addOptimisticProject}>
          <Button className="w-full md:w-auto shrink-0">
            <Plus className="mr-2 h-4 w-4" />
            Nouveau projet
          </Button>
        </CreateProjectDialog>
      </div>

      {optimisticProjects.length === 0 ? (
        /* Empty State : Identique mobile & desktop */
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card p-8 md:p-12 text-center animate-in fade-in-50 duration-500">
          <div className="flex h-12 w-12 md:h-14 md:w-14 items-center justify-center rounded-full bg-secondary mb-4">
            <FolderOpen className="h-5 w-5 md:h-6 md:w-6 text-muted-foreground" />
          </div>
          <h2 className="text-base md:text-lg font-medium text-foreground mb-1">
            Aucun projet actif
          </h2>
          <p className="text-sm text-muted-foreground max-w-sm mb-6">
            Créez votre premier projet pour générer une instance API et commencer à automatiser vos communications.
          </p>
          <CreateProjectDialog addOptimisticProject={addOptimisticProject}>
            <Button variant="outline" className="hidden sm:flex w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              Créer mon premier projet
            </Button>
          </CreateProjectDialog>
        </div>
      ) : (
        <>
          {/* VUE MOBILE : Affichage en Cartes (Masqué sur desktop) */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {optimisticProjects.map((project) => (
              <div
                key={project.id}
                className="flex flex-col p-5 rounded-xl border border-border bg-card shadow-sm space-y-4"
              >
                {/* Header de la carte : Nom et Statut */}
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-base text-foreground truncate">{project.name}</h3>
                  <Badge
                    variant={
                      project.status === "active" ? "default" :
                        project.status === "paused" ? "secondary" :
                          "outline"
                    }
                    className="font-normal shrink-0"
                  >
                    {project.status === "active" ? "Actif" :
                      project.status === "paused" ? "En pause" : "Terminé"}
                  </Badge>
                </div>

                {/* Corps de la carte : Données techniques */}
                <div className="grid grid-cols-1 gap-3 text-sm">
                  {/* Numéro WhatsApp */}
                  <div className="flex gap-3 text-muted-foreground">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
                      <Smartphone className="h-4 w-4" />
                    </div>
                    <span className="font-mono tracking-tight text-foreground">{project.numero}</span>
                  </div>


                  {/* Instance et Connexion */}
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-2">
                      <Server className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs font-mono text-muted-foreground truncate max-w-30">
                        {project.instanceName}
                      </span>
                    </div>

                    {/* Statut de connexion Evolution API */}
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

                  <p className="font-mono text-sm tracking-tight">Expire le: {" "}
                    <span className="text-muted-foreground">
                      {new Date(project.createdAt).toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric"
                      })}
                    </span>
                  </p>

                  <div className="flex flex-col justify-center items-center gap-2 mt-2 pt-2 border-t border-border/50">
                    <Button className="w-full" size="sm">
                      Renouveler !
                    </Button>
                    <Button className="w-full" variant="outline" size="sm">
                      Gerer
                    </Button>
                    <Button className="w-full" variant="ghost" size="sm">
                      Plus d&apos;infos
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* VUE DESKTOP : Le Tableau existant (Masqué sur mobile) */}
          <div className="hidden md:block rounded-xl border border-border bg-card shadow-sm overflow-hidden">
            <Table>
              <TableHeader className="bg-secondary/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-medium h-11">Projet</TableHead>
                  <TableHead className="font-medium h-11">Numéro cible</TableHead>
                  <TableHead className="font-medium h-11">ID Instance</TableHead>
                  <TableHead className="font-medium h-11">Connexion</TableHead>
                  <TableHead className="font-medium h-11">Statut</TableHead>
                  <TableHead className="font-medium h-11 text-right">Expire le</TableHead>
                  <TableHead className="font-medium h-11 text-right"></TableHead>

                </TableRow>
              </TableHeader>
              <TableBody>
                {optimisticProjects.map((project,id) => (
                  <TableRow
                  key={id}
                    className="transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                  >
                    <TableCell className="font-medium text-foreground py-4">
                      <Link href={`dashboard/projects/${project.id}`}>
                        {project.name}
                      </Link>
                    </TableCell>

                    <TableCell className="py-4">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Smartphone className="h-3.5 w-3.5" />
                        <span className="font-mono tracking-tight">{project.numero}</span>
                      </div>
                    </TableCell>

                    <TableCell className="py-4">
                      <span className="inline-flex items-center rounded-md bg-secondary px-2 py-1 text-xs font-mono text-secondary-foreground">
                        {project.instanceName}
                      </span>
                    </TableCell>

                    <TableCell className="py-4">
                      <div className="flex items-center gap-2">
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
                    </TableCell>

                    <TableCell className="py-4">
                      <Badge
                        variant={
                          project.status === "active" ? "default" :
                            project.status === "paused" ? "secondary" :
                              "outline"
                        }
                        className="font-normal"
                      >
                        {project.status === "active" ? "Actif" :
                          project.status === "paused" ? "En pause" : "Terminé"}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-right text-xs text-muted-foreground py-4 tabular-nums">
                      {new Date(project.createdAt).toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric"
                      })}
                    </TableCell>
                    <TableCell className="py-4 text-sm flex flex-row justify-end items-center gap-1">
                      <Button size="sm">
                        Renouveler !
                      </Button>
                      <Button variant="outline" size="sm">
                        Gerer
                      </Button>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  )
}