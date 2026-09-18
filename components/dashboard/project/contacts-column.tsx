"use client";
import type { ColumnDef } from "@tanstack/react-table";
import type { ReactNode } from "react";
import { Phone } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/components/getInitials";
export type ContactTableType = {
  id: string;
  name: string | null;
  displayName: string;
  phone: string;
  aiActive: boolean;
  aiVersion: number;
  createdAt: string;
  lastMessageAt: string | null;
  messageCount: number;
  preview: string;
};
export function ContactsTableColumns(options: {
  renderActions: (contact: ContactTableType) => ReactNode;
  renderStatus: (contact: ContactTableType) => ReactNode;
}): ColumnDef<ContactTableType>[] {
  return [
    {
      accessorKey: "name",
      header: "Identité",
      enableHiding: false,
      cell: ({ row: { original: contact } }) => (
        <div className="flex items-center gap-3">
          <Avatar className="size-8">
            <AvatarFallback>{getInitials(contact.displayName)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="max-w-48 truncate font-medium">
              {contact.displayName}
            </p>
            <p className="text-xs text-muted-foreground md:hidden">
              {contact.phone}
            </p>
            {!contact.name && contact.displayName !== contact.phone && (
              <p className="text-[10px] text-muted-foreground">
                Nom public WhatsApp
              </p>
            )}
          </div>
        </div>
      ),
    },
    {
      accessorKey: "phone",
      header: "Numéro WhatsApp",
      cell: ({ row }) => (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Phone className="size-3.5" />
          <span className="font-mono">
            {row.original.phone.startsWith("+")
              ? row.original.phone
              : `+${row.original.phone}`}
          </span>
        </div>
      ),
    },
    {
      accessorKey: "aiActive",
      header: "Prise en charge",
      cell: ({ row }) => options.renderStatus(row.original),
    },
    {
      accessorKey: "createdAt",
      header: "Ajouté le",
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {new Intl.DateTimeFormat("fr-FR", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            timeZone: "UTC",
          }).format(new Date(row.original.createdAt))}
        </span>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      enableHiding: false,
      cell: ({ row }) => options.renderActions(row.original),
    },
  ];
}
