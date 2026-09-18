"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Settings2,
  Search,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { ContactsTableColumns, type ContactTableType } from "./contacts-column";

function subscribeToViewport(callback: () => void) {
  const media = window.matchMedia("(max-width: 767px)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}
const mobileSnapshot = () => window.matchMedia("(max-width: 767px)").matches;
const serverSnapshot = () => false;

type Props = {
  data: ContactTableType[];
  projectId: string;
  query: string;
  onQueryChange: (query: string) => void;
  page: number;
  pageCount: number;
  total: number;
  pending: boolean;
  busy: boolean;
  onPageChange: (page: number) => void;
  onRename: (contact: ContactTableType) => void;
  onDelete: (contact: ContactTableType) => void;
  renderStatus: (contact: ContactTableType) => ReactNode;
};

export function ContactsTable(p: Props) {
  const isMobile = useSyncExternalStore(
    subscribeToViewport,
    mobileSnapshot,
    serverSnapshot,
  );
  const [desktopVisibility, setDesktopVisibility] = useState<VisibilityState>(
    {},
  );
  const [mobileVisibility, setMobileVisibility] = useState<VisibilityState>({
    phone: false,
    aiActive: false,
    createdAt: false,
  });
  const columns = ContactsTableColumns({
    renderStatus: p.renderStatus,
    renderActions: (contact) => (
      <div className="flex items-center justify-end gap-1">
        <Button asChild variant="ghost" size="icon" className="size-10">
          <Link
            href={`/projects/${p.projectId}/chat?contactId=${encodeURIComponent(contact.id)}`}
            aria-label={`Chatter avec ${contact.displayName}`}
            title="Chatter"
          >
            <MessageSquare className="size-4" />
          </Link>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-10"
          disabled={p.busy || p.pending}
          onClick={() => p.onRename(contact)}
          aria-label={`Modifier le nom de ${contact.displayName}`}
          title="Modifier le nom"
        >
          <Pencil className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-10 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          disabled={p.busy || p.pending}
          onClick={() => p.onDelete(contact)}
          aria-label={`Supprimer ${contact.displayName}`}
          title="Supprimer"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    ),
  });
  const table = useReactTable({
    data: p.data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
    manualPagination: true,
    manualFiltering: true,
    manualSorting: true,
    pageCount: p.pageCount,
    onColumnVisibilityChange: isMobile
      ? setMobileVisibility
      : setDesktopVisibility,
    state: {
      columnVisibility: isMobile ? mobileVisibility : desktopVisibility,
      pagination: { pageIndex: p.page - 1, pageSize: 20 },
    },
  });
  const labels: Record<string, string> = {
    phone: "Numéro",
    aiActive: "Prise en charge",
    createdAt: "Date d’ajout",
  };
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-sm">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={p.query}
            onChange={(event) => p.onQueryChange(event.target.value)}
            maxLength={100}
            placeholder="Rechercher un nom ou un numéro…"
            aria-label="Rechercher un contact par nom ou numéro"
            className="h-10 bg-background pl-9 pr-10"
          />
          {p.query && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1 size-8"
              aria-label="Effacer la recherche"
              onClick={() => p.onQueryChange("")}
            >
              <X className="size-4" />
            </Button>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="h-10">
              <Settings2 className="size-4" />
              <span className="hidden sm:inline">Colonnes</span>
              <span className="sr-only sm:hidden">Choisir les colonnes</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {table
              .getAllColumns()
              .filter((column) => column.getCanHide())
              .map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  checked={column.getIsVisible()}
                  onCheckedChange={(value) => column.toggleVisibility(!!value)}
                >
                  {labels[column.id] || column.id}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div
        className={`overflow-hidden rounded-xl border bg-card ${p.pending ? "opacity-60" : ""}`}
      >
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id} className="bg-muted/40">
                {group.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={
                      header.column.id === "actions" ? "text-right" : ""
                    }
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-3">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={table.getVisibleLeafColumns().length}
                  className="h-32 text-center text-muted-foreground"
                >
                  {p.pending
                    ? "Recherche en cours…"
                    : "Aucun contact trouvé. Les nouveaux contacts WhatsApp apparaîtront ici."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>
          {p.total.toLocaleString("fr-FR")} contact{p.total !== 1 ? "s" : ""}
        </span>
        <div className="flex items-center gap-2">
          <span>
            Page {p.page} sur {p.pageCount}
          </span>
          <Button
            variant="outline"
            size="icon"
            disabled={p.pending || p.page <= 1}
            onClick={() => p.onPageChange(p.page - 1)}
            aria-label="Page précédente"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            disabled={p.pending || p.page >= p.pageCount}
            onClick={() => p.onPageChange(p.page + 1)}
            aria-label="Page suivante"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
