"use client"

import { Project } from "@/src/generated/prisma/client"
import { ColumnDef } from "@tanstack/react-table"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { ArrowUpDown, MoreHorizontal, Smartphone, Server, Copy, Eye } from "lucide-react"

// Fonction utilitaire sécurisée pour le presse-papier
const copyToClipboard = async (text: string) => {
    if (navigator?.clipboard) {
        try {
            await navigator.clipboard.writeText(text)
            // Optionnel: Ajouter un toast de succès ici (ex: toast.success("Copié !"))
        } catch (err) {
            console.error("Échec de la copie", err)
        }
    }
}

export const ProjectsTableColumns: ColumnDef<Project>[] = [
    {
        id: "select",
        header: ({ table }) => (
            <Checkbox
                checked={
                    table.getIsAllPageRowsSelected() ||
                    (table.getIsSomePageRowsSelected() && "indeterminate")
                }
                onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                aria-label="Sélectionner toutes les lignes"
            />
        ),
        cell: ({ row }) => (
            <Checkbox
                checked={row.getIsSelected()}
                onCheckedChange={(value) => row.toggleSelected(!!value)}
                aria-label="Sélectionner la ligne"
            />
        ),
        enableSorting: false,
        enableHiding: false,
    },
    {
        accessorKey: "name",
        header: "Projet",
        cell: ({ row }) => <span className="font-semibold">{row.original.name}</span>,
    },
    {
        accessorKey: "numero",
        header: ({ column }) => {
            return (
                <Button
                    variant="ghost"
                    className="p-0 hover:bg-transparent"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                >
                    Numéro cible
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            )
        },
        cell: ({ row }) => (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Smartphone className="h-3.5 w-3.5" />
                <span className="font-mono tracking-tight">{row.original.numero}</span>
            </div>
        ),
    },
    {
        accessorKey: "instanceName",
        header: "Instance",
        cell: ({ row }) => (
            <span className="inline-flex items-center rounded-md bg-secondary px-2 py-1 text-xs font-mono text-secondary-foreground">
                <Server className="mr-1 h-3 w-3" />
                {row.original.instanceName}
            </span>
        ),
    },
    {
        accessorKey: "instanceStatus",
        header: "Etat du numéro",
        cell: ({ row }) => {
            const status = row.original.instanceStatus;
            return (
                <div className="flex items-center gap-2">
                    {status === "connected" ? (
                        <>
                            <div className="h-2 w-2 rounded-full bg-green-500 ring-2 ring-green-500/20" />
                            <span className="text-xs font-medium">Connecté</span>
                        </>
                    ) : status === "connecting" ? (
                        <>
                            <div className="h-2 w-2 rounded-full bg-yellow-500 ring-2 ring-yellow-500/20 animate-pulse" />
                            <span className="text-xs font-medium">En cours</span>
                        </>
                    ) : (
                        <>
                            <div className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                            <span className="text-xs font-medium text-muted-foreground">Déconnecté</span>
                        </>
                    )}
                </div>
            )
        },
    },
    {
        accessorKey: "status",
        header: "Statut du projet",
        cell: ({ row }) => {
            const status = row.original.status;

            // Dictionnaire de configuration des statuts
            const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
                active: { label: "Actif", variant: "default" },       // Souvent vert/primaire par défaut
                trialing: { label: "En essai", variant: "secondary" }, // Couleur secondaire pour l'essai
                paused: { label: "En pause", variant: "outline" },     // Contour simple pour un état neutre/en attente
                inactive: { label: "Inactif", variant: "destructive" } // Rouge/Destructif pour un arrêt
            };

            // On récupère la config correspondante, avec un fallback sécurisé au cas où un statut inattendu apparaît
            const config = statusConfig[status] || { label: "Inconnu", variant: "outline" };

            return (
                <Badge
                    variant={config.variant}
                    className="font-normal"
                >
                    {config.label}
                </Badge>
            )
        },
    },
    {
        id: "expiration", // On utilise un 'id' personnalisé au lieu de 'accessorKey'
        accessorFn: (row) => row.stripeCurrentPeriodEnd || row.expiredAt, // Le tableau utilise cette valeur pour le tri
        header: "Expire le",
        cell: ({ getValue }) => {
            const rawDate = getValue() as Date | null;

            // Sécurité : si le projet n'a aucune des deux dates
            if (!rawDate) {
                return <span className="text-muted-foreground text-sm italic">Non défini</span>;
            }

            // Formatage sécurisé
            const formatted = new Intl.DateTimeFormat("fr-FR", {
                day: "2-digit",
                month: "short",
                year: "numeric"
            }).format(new Date(rawDate));

            return <span className="tabular-nums text-muted-foreground text-sm">{formatted}</span>;
        },
    },
    {
        id: "actions",
        enableHiding: false,
        cell: ({ row }) => {
            const project = row.original

            return (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Ouvrir le menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => copyToClipboard(project.id)}>
                            <Copy className="mr-2 h-4 w-4" />
                            Copier l&apos;ID du projet
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>
                            <Eye className="mr-2 h-4 w-4" />
                            Voir les détails
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            )
        },
    },
]