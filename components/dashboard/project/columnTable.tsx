"use client"

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
import { Badge } from "@/components/ui/badge"
import { ArrowUpDown, MoreHorizontal, Smartphone, Eye, Settings, CreditCardIcon } from "lucide-react"
import Link from "next/link"
import { CustomProjectProps } from "./homePage"

// Dictionnaire de configuration des statuts
const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
    active: { label: "Actif", variant: "default" },       // Souvent vert/primaire par défaut
    trialing: { label: "En essai", variant: "secondary" }, // Couleur secondaire pour l'essai
    paused: { label: "En pause", variant: "outline" },     // Contour simple pour un état neutre/en attente
    inactive: { label: "Inactif", variant: "destructive" } // Rouge/Destructif pour un arrêt
};
export const ProjectsTableColumns: ColumnDef<CustomProjectProps["projects"][0]>[] = [

    {
        accessorKey: "name",
        header: "Projet",
        cell: ({ row }) => (
            <Link href={`/dashboard/projects/${row.original.id}`} title={row.original.id} className="font-semibold hover:underline">
                {row.original.name}
            </Link>
        ),
    },
    {
        accessorKey: "numero",
        header: ({ column }) => {
            return (
                <Button
                    variant="ghost"
                    className="p-0 hover:bg-transparent text-muted-foreground"
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
        accessorKey: "plan",
        header: "Plan",
        cell: ({ row }) => (
            <span className="inline-flex items-center rounded-md bg-secondary px-2 py-1 text-xs font-mono text-secondary-foreground">
                <CreditCardIcon className="mr-1 h-3 w-3" />
                {row.original.plan}
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
        id: "usage", // id personnalisé car on utilise deux champs différents
        header: "Utilisation",
        cell: ({ row }) => {
            // Récupération sécurisée des valeurs
            const used = row.original.messageCount || 0;
            const limit = row.original.aLlmessagesCount || 0; // Attention à ton "L" majuscule ici !
            console.log(`Calcul de l'utilisation pour le projet ${row.original.id}: used=${used}, limit=${limit}`); // Log pour debug
            // Calcul du pourcentage (avec protection contre la division par zéro)
            // Math.min évite de dépasser 100% si jamais used > limit pour une raison quelconque
            const percentage = limit > 0 ? Math.min(Math.round((used / limit) * 100), 100) : 0;

            // Logique UI/UX : alerter visuellement si l'utilisateur approche de sa limite
            const isNearLimit = percentage >= 90;

            return (
                <div className="flex w-full min-w-[130px] flex-col gap-1.5">
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                            {used.toLocaleString('fr-FR')} / {limit.toLocaleString('fr-FR')}
                        </span>
                        <span className={`font-medium ${isNearLimit ? "text-destructive animate-pulse" : "text-foreground"}`}>
                            {percentage}%
                        </span>
                    </div>

                    {/* Barre de progression en pur Tailwind (plus flexible que Shadcn pour changer les couleurs dynamiquement) */}
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                        <div
                            className={`h-full transition-all duration-500 ease-in-out ${isNearLimit ? "bg-destructive" : "bg-primary"
                                }`}
                            style={{ width: `${percentage}%` }}
                        />
                    </div>
                </div>
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
                        <DropdownMenuItem>
                            <Settings className="mr-2 h-4 w-4" />
                            Gerer
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>
                            <Link href={`/dashboard/projects/${project.id}`}>
                                <Eye className="mr-2 h-4 w-4" />
                                Ouvrir
                            </Link>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            )
        },
    },
]