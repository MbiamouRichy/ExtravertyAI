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
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Settings2,
  MoreHorizontal,
  Bot,
  UserRound,
  Search,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/components/getInitials";
import { LocalDate } from "@/components/local-date";
import { ContactsTableColumns, type ContactTableType } from "./contacts-column";
import { InstinctCell } from "./instinct-badge";

// Trois largeurs : cartes (mobile), tableau resserré (tablette, petit écran
// avec barre latérale) et tableau complet. Chacune garde ses propres choix de colonnes.
type ViewportTier = "mobile" | "compact" | "wide";
const MOBILE_QUERY = "(max-width: 767px)";
const COMPACT_QUERY = "(max-width: 1279px)";

function subscribeToViewport(callback: () => void) {
  const queries = [MOBILE_QUERY, COMPACT_QUERY].map((query) =>
    window.matchMedia(query),
  );
  queries.forEach((media) => media.addEventListener("change", callback));
  return () =>
    queries.forEach((media) => media.removeEventListener("change", callback));
}
const tierSnapshot = (): ViewportTier =>
  window.matchMedia(MOBILE_QUERY).matches
    ? "mobile"
    : window.matchMedia(COMPACT_QUERY).matches
      ? "compact"
      : "wide";
const serverSnapshot = (): ViewportTier => "wide";

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
  onToggleAi: (contact: ContactTableType) => void;
  renderStatus: (contact: ContactTableType) => ReactNode;
};

export function ContactsTable(p: Props) {
  const tier = useSyncExternalStore(
    subscribeToViewport,
    tierSnapshot,
    serverSnapshot,
  );
  const [visibility, setVisibility] = useState<
    Record<ViewportTier, VisibilityState>
  >({
    // Carte : numéro sous le nom, Instinct IA et prise en charge sur une ligne.
    mobile: { createdAt: false },
    // Identité (avec le numéro dessous), prise en charge et actions tiennent sans défilement.
    compact: { phone: false, instinct: false, createdAt: false },
    wide: {},
  });
  const columnVisibility = visibility[tier];
  // Les cartes n'existent que sur mobile : elles suivent toujours ces choix-là,
  // y compris au premier rendu serveur (pas de saut de mise en page).
  const showOnMobile = (column: string) => visibility.mobile[column] !== false;
  const columns = ContactsTableColumns({
    phoneUnderName: columnVisibility.phone === false,
    renderStatus: p.renderStatus,
    renderActions: (contact) => (
      <div className="flex items-center justify-end gap-1">
        <Button
          asChild
          variant="ghost"
          size="icon"
          className="h-10 w-auto min-w-0 flex-1 gap-2 px-3 md:size-10 md:flex-none md:p-0"
        >
          <Link
            href={`/projects/${p.projectId}/chat?contactId=${encodeURIComponent(contact.id)}`}
            aria-label={`Chatter avec ${contact.displayName}`}
            title="Chatter"
          >
            <MessageSquare className="size-4 shrink-0" />
            <span className="md:hidden">Discuter</span>
          </Link>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-10 shrink-0"
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
          className="size-10 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
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
    onColumnVisibilityChange: (updater) =>
      setVisibility((previous) => ({
        ...previous,
        [tier]:
          typeof updater === "function" ? updater(previous[tier]) : updater,
      })),
    state: {
      columnVisibility,
      pagination: { pageIndex: p.page - 1, pageSize: 20 },
    },
  });
  const labels: Record<string, string> = {
    phone: "Numéro",
    aiActive: "Prise en charge",
    instinct: "Instinct IA",
    createdAt: "Date d’ajout",
  };
  return (
    <div className="min-w-0 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
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
            <Button variant="outline" className="h-10 shrink-0">
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
        className={
          "-mx-4 overflow-hidden border-y md:hidden sm:-mx-5 " +
          (p.pending ? "opacity-60" : "")
        }
        aria-busy={p.pending}
      >
        {table.getRowModel().rows.length ? (
          <ul aria-label="Contacts" className="divide-y">
            {table.getRowModel().rows.map((row) => {
              const contact = row.original;
              const chatHref = `/projects/${p.projectId}/chat?contactId=${encodeURIComponent(contact.id)}`;
              const meta =
                showOnMobile("instinct") ||
                showOnMobile("aiActive") ||
                showOnMobile("createdAt");
              return (
                // Toute la ligne ouvre la conversation, comme dans WhatsApp ;
                // le menu ⋯ reste au-dessus pour les autres actions.
                <li
                  key={row.id}
                  className="relative flex min-w-0 gap-3 px-4 py-3 transition-colors hover:bg-muted/40 active:bg-muted/60 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring has-[a:focus-visible]:ring-inset motion-reduce:transition-none sm:px-5"
                >
                  <Avatar className="size-10 shrink-0">
                    {contact.avatarUrl && (
                      <AvatarImage src={contact.avatarUrl} alt="" className="object-cover" />
                    )}
                    <AvatarFallback>{getInitials(contact.displayName)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm font-medium leading-snug wrap-anywhere">
                          <Link
                            href={chatHref}
                            aria-label={`Discuter avec ${contact.displayName}`}
                            className="outline-none after:absolute after:inset-0"
                          >
                            {contact.displayName}
                          </Link>
                        </p>
                        {showOnMobile("phone") && (
                          <p className="truncate font-mono text-xs text-muted-foreground tabular-nums">
                            {contact.phone.startsWith("+") ? contact.phone : `+${contact.phone}`}
                          </p>
                        )}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="relative z-10 -mr-2 -mt-1.5 size-9 shrink-0 rounded-full"
                            disabled={p.busy || p.pending}
                            aria-label={"Actions pour " + contact.displayName}
                          >
                            <MoreHorizontal aria-hidden />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="w-64 max-w-[calc(100vw-2rem)]"
                        >
                          <DropdownMenuLabel className="space-y-1 whitespace-normal break-words">
                            <span className="block">{contact.displayName}</span>
                            <span className="block text-xs font-normal text-muted-foreground">
                              Actions du contact
                            </span>
                          </DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem asChild>
                            <Link href={chatHref}>
                              <MessageSquare aria-hidden />
                              Discuter
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => p.onRename(contact)}>
                            <Pencil aria-hidden />
                            Modifier le nom
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => p.onToggleAi(contact)}
                          >
                            {contact.aiActive ? (
                              <UserRound aria-hidden />
                            ) : (
                              <Bot aria-hidden />
                            )}
                            {contact.aiActive
                              ? "Confier à l’équipe"
                              : "Activer l’assistant IA"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => p.onDelete(contact)}
                          >
                            <Trash2 aria-hidden />
                            Supprimer le contact
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    {meta && (
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
                        {showOnMobile("instinct") && (
                          <InstinctCell classification={contact.instinct} />
                        )}
                        {showOnMobile("aiActive") && (
                          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                            {contact.aiActive ? (
                              <Bot aria-hidden className="size-3.5 shrink-0" />
                            ) : (
                              <UserRound aria-hidden className="size-3.5 shrink-0" />
                            )}
                            {contact.aiActive ? "Assistant IA" : "Équipe humaine"}
                          </span>
                        )}
                        {showOnMobile("createdAt") && (
                          <span className="whitespace-nowrap">
                            Ajouté le{" "}
                            <LocalDate
                              value={contact.createdAt}
                              options={{ day: "2-digit", month: "short", year: "numeric" }}
                            />
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            {p.pending
              ? "Recherche en cours…"
              : "Aucun contact trouvé. Les nouveaux contacts WhatsApp apparaîtront ici."}
          </p>
        )}
      </div>
      <div
        className={`hidden overflow-hidden rounded-xl border bg-card md:block ${p.pending ? "opacity-60" : ""}`}
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
      <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span>
          {p.total.toLocaleString("fr-FR")} contact{p.total !== 1 ? "s" : ""}
        </span>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <span className="mr-auto sm:mr-0">
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
