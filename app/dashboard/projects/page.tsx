import { getProjects } from "@/app/actions/projects"
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
import { Plus, Smartphone, FolderOpen } from "lucide-react"

export default async function ProjectsPage() {
  const projects = await getProjects()

  return (
    <div className="flex flex-col space-y-8 p-8 md:p-10 w-full max-w-300 mx-auto">
      {/* En-tête de page (Éditorial & Épuré) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Projets
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Gérez vos flux d&apos;automatisation et surveillez l&apos;état de vos instances en temps réel.
          </p>
        </div>
        <Button className="shrink-0">
          <Plus className="mr-2 h-4 w-4" /> 
          Nouveau projet
        </Button>
      </div>

      {projects.length === 0 ? (
        /* Empty State : Design typique des startups SaaS pour inciter à l'action */
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card p-12 text-center animate-in fade-in-50 duration-500">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary mb-4">
            <FolderOpen className="h-6 w-6 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-medium text-foreground mb-1">
            Aucun projet actif
          </h2>
          <p className="text-sm text-muted-foreground max-w-sm mb-6">
            Créez votre premier projet pour générer une instance API et commencer à automatiser vos communications.
          </p>
          <Button variant="outline">
            <Plus className="mr-2 h-4 w-4" /> 
            Créer mon premier projet
          </Button>
        </div>
      ) : (
        /* Conteneur de la table avec un subtil effet d'ombre et de bordure */
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <Table>
            <TableHeader className="bg-secondary/50">
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-medium h-11">Projet</TableHead>
                <TableHead className="font-medium h-11">Numéro cible</TableHead>
                <TableHead className="font-medium h-11">Instance API</TableHead>
                <TableHead className="font-medium h-11">Connexion</TableHead>
                <TableHead className="font-medium h-11">Statut</TableHead>
                <TableHead className="font-medium h-11 text-right">Créé le</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((project) => (
                <TableRow 
                  key={project.id} 
                  className="transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                >
                  {/* Nom du projet */}
                  <TableCell className="font-medium text-foreground py-4">
                    {project.name}
                  </TableCell>
                  
                  {/* Numéro WhatsApp avec icône */}
                  <TableCell className="py-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Smartphone className="h-3.5 w-3.5" />
                      <span className="font-mono tracking-tight">{project.numero}</span>
                    </div>
                  </TableCell>
                  
                  {/* Instance Name (Technique) */}
                  <TableCell className="py-4">
                    <span className="inline-flex items-center rounded-md bg-secondary px-2 py-1 text-xs font-mono text-secondary-foreground">
                      {project.instanceName}
                    </span>
                  </TableCell>
                  
                  {/* Statut de l'instance Evolution API (Indicateurs points) */}
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
                  
                  {/* Statut Global du Projet avec les Badges Shadcn */}
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
                  
                  {/* Date de création */}
                  <TableCell className="text-right text-xs text-muted-foreground py-4 tabular-nums">
                    {new Date(project.createdAt).toLocaleDateString("fr-FR", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric"
                    })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}