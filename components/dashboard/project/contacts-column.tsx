"use client"

import { ColumnDef, Row } from "@tanstack/react-table"
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
import { ArrowUpDown, MoreHorizontal, MessageSquare, Bot, User, UserX, Phone } from "lucide-react"
import DeleteContact from "./deleteContact"
import ToggleContactAi from "./ToggleContactAI"
import { useRouter } from "next/navigation"
import { state } from "@/lib/proxy-state"
import { getInitials } from "@/components/getInitials"

// Type représentant le modèle Prisma Contact
export type ContactTableType = {
    id: string;
    phone: string;
    pushName: string | null;
    name: string | null;
    aiActive: boolean;
    createdAt: Date;
    projectId: string;
};

export const ContactsTableColumns: ColumnDef<ContactTableType>[] = [

    {
        accessorKey: "name",
        header: "Identité",
        cell: ({ row }) => {
            const name = row.original.name;
            const pushName = row.original.pushName;
            const displayName = name || pushName || "Inconnu";

            return (
                <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 border border-neutral-200 dark:bg-neutral-800 dark:border-neutral-700">
                        <span className="text-xs font-medium text-neutral-600 dark:text-neutral-300">{getInitials(displayName)}</span>
                    </div>
                    {/* min-w-0 permet au texte de se tronquer proprement s'il est trop long */}
                    <div className="flex flex-col min-w-0">
                        <span className="font-medium truncate max-w-50 sm:max-w-62.5">{displayName}</span>
                        {!name && pushName && (
                            <span className="text-[10px] text-muted-foreground">Nom public WhatsApp</span>
                        )}
                    </div>
                </div>
            )
        },
    },

    {
        accessorKey: "phone",
        header: ({ column }) => {
            return (
                <Button
                    variant="ghost"
                    className="p-0 hover:bg-transparent text-muted-foreground"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                >
                    Numéro WhatsApp
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            )
        },
        cell: ({ row }) => (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="h-3.5 w-3.5" />
                <span className="font-mono tracking-tight">+{row.original.phone}</span>
            </div>
        ),
    },
    {
        accessorKey: "aiActive",
        header: "Statut Prise en charge",
        cell: ({ row }) => {
            const isAiActive = row.original.aiActive;

            return (
                <Badge
                    variant={isAiActive ? "secondary" : "outline"}
                    className="font-normal gap-1.5"
                >
                    {isAiActive ? (
                        <><Bot className="h-3 w-3" /> IA Connectée</>
                    ) : (
                        <><User className="h-3 w-3" /> Agent Humain</>
                    )}
                </Badge>
            )
        },
    },
    {
        accessorKey: "createdAt",
        header: "Ajouté le",
        cell: ({ row }) => {
            const date = row.original.createdAt;
            const formatted = new Intl.DateTimeFormat("fr-FR", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            }).format(new Date(date));

            return <span className="text-xs text-muted-foreground">{formatted}</span>;
        },
    },
    {
        id: "actions",
        enableHiding: false,
        header: "", // On s'assure qu'il n'y a pas de titre en haut de cette colonne
        cell: ({ row }) => <ContactRow row={row} />,
    },
]


function ContactRow({ row }: { row: Row<ContactTableType> }) {
    const router = useRouter()
    const contact = row.original
    const handleNavigateToChat = (projectId: string, contactId: string) => {
        state.activeClient = contactId;
        router.push(`/projects/${projectId}`);
    };
    return (
        // On pousse le bouton tout à droite
        <div className="flex justify-end">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Ouvrir le menu</span>
                        <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-fit min-w-48">
                    <DropdownMenuLabel className="truncate">Actions {contact.name || contact.phone}</DropdownMenuLabel>
                    <DropdownMenuItem className="cursor-pointer" onClick={() => handleNavigateToChat(contact.projectId, contact.id)}>
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Ouvrir la conversation
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="cursor-pointer" asChild onSelect={(e) => e.preventDefault()}>
                        <ToggleContactAi projectId={contact.projectId} contact={contact} />
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DeleteContact projectId={contact.projectId} contact={contact}>
                        <DropdownMenuItem variant="destructive" className="cursor-pointer" onSelect={(e) => e.preventDefault()}>
                            <UserX className="mr-2 h-4 w-4" />
                            Supprimer le contact
                        </DropdownMenuItem>
                    </DeleteContact>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    )
}