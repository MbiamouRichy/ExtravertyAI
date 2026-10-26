"use client";
import { LocalDate } from "@/components/local-date";
import type { ColumnDef } from "@tanstack/react-table";
import type { ReactNode } from "react";
import { Phone } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/components/getInitials";
import type { ProspectClassification } from "@/lib/instinct-classification";
import { InstinctCell } from "./instinct-badge";
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
  instinct: ProspectClassification | null;
};
export function ContactsTableColumns(options: {
  /** Colonne « Numéro » masquée : le numéro s'affiche sous le nom. */
  phoneUnderName: boolean;
  renderActions: (contact: ContactTableType) => ReactNode;
  renderStatus: (contact: ContactTableType) => ReactNode;
}): ColumnDef<ContactTableType>[] {
  return [
    {
      accessorKey: "name",
      header: "Identité",
      enableHiding: false,
      cell: ({ row: { original: contact } }) => (
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="size-8">
            <AvatarFallback>{getInitials(contact.displayName)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="whitespace-normal wrap-anywhere font-medium md:max-w-48 md:truncate">
              {contact.displayName}
            </p>
            {options.phoneUnderName && (
              <p className="wrap-anywhere font-mono text-xs text-muted-foreground">
                {contact.phone.startsWith("+")
                  ? contact.phone
                  : `+${contact.phone}`}
              </p>
            )}
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
      accessorKey: "instinct",
      header: "Instinct IA",
      cell: ({ row }) => (
        <InstinctCell classification={row.original.instinct} />
      ),
    },
    {
      accessorKey: "createdAt",
      header: "Ajouté le",
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          <LocalDate
            value={row.original.createdAt}
            options={{ day: "2-digit", month: "short", year: "numeric" }}
          />
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
