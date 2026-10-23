"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ArrowUpRight,
  Bot,
  MessageSquare,
  MessageSquareOff,
  Search,
  User,
  X,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { AnalyticsCard } from "./analytics-card";
import { InstinctCell } from "./project/instinct-badge";
import { ChartEmptyState } from "./chart-empty-state";
import { cn } from "@/lib/utils";
import { formatNumberFr, type TopContactRow } from "@/lib/analytics";

type Row = TopContactRow & { rank: number };

function getInitials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "?"
  );
}

function AiBadge({ active }: { active: boolean }) {
  const Icon = active ? Bot : User;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] font-medium",
        active
          ? "border-foreground/20 bg-foreground/5 text-foreground"
          : "bg-muted/40 text-muted-foreground",
      )}
    >
      <Icon aria-hidden="true" className="size-3" />
      {active ? "IA activée" : "IA désactivée"}
    </span>
  );
}

/** En-tête triable : un clic trie, l’état est annoncé aux lecteurs d’écran. */
function SortHeader({
  label,
  sorted,
  onToggle,
  align = "right",
}: {
  label: string;
  sorted: false | "asc" | "desc";
  onToggle: () => void;
  align?: "left" | "right";
}) {
  const Icon =
    sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ArrowUpDown;
  return (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      onClick={onToggle}
      className={cn("-mx-2 gap-1 text-xs", align === "right" && "ml-auto flex")}
      aria-label={`Trier par ${label.toLowerCase()}`}
    >
      {label}
      <Icon
        aria-hidden="true"
        className={cn("size-3", !sorted && "text-muted-foreground/60")}
      />
    </Button>
  );
}

function chatHref(projectId: string, contactId: string) {
  return `/projects/${encodeURIComponent(projectId)}/chat?contactId=${encodeURIComponent(contactId)}`;
}

interface TopContactsCardProps {
  projectId: string;
  contacts: TopContactRow[];
  rangeLabel: string;
}

/**
 * Les 15 contacts les plus actifs de la période, dans un tableau filtrable et
 * triable, avec un accès direct à leur discussion.
 */
export function TopContactsCard({
  projectId,
  contacts,
  rangeLabel,
}: TopContactsCardProps) {
  const data = useMemo<Row[]>(
    () => contacts.map((contact, index) => ({ ...contact, rank: index + 1 })),
    [contacts],
  );
  const [query, setQuery] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo<ColumnDef<Row>[]>(
    () => [
      {
        accessorKey: "rank",
        header: () => <span className="sr-only">Rang</span>,
        cell: ({ row }) => (
          <span className="text-xs tabular-nums text-muted-foreground">
            {row.original.rank}
          </span>
        ),
      },
      {
        id: "contact",
        accessorFn: (row) => `${row.name} ${row.phone}`,
        header: "Contact",
        cell: ({ row }) => (
          <div className="flex min-w-0 items-center gap-3">
            <Avatar className="size-8 shrink-0 border">
              <AvatarFallback className="bg-muted/60 text-[11px] font-medium">
                {getInitials(row.original.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {row.original.name}
              </p>
              <p className="truncate text-xs tabular-nums text-muted-foreground">
                {row.original.phone}
              </p>
            </div>
          </div>
        ),
      },
      {
        accessorKey: "received",
        header: ({ column }) => (
          <SortHeader
            label="Reçus"
            sorted={column.getIsSorted()}
            onToggle={() =>
              column.toggleSorting(column.getIsSorted() !== "desc")
            }
          />
        ),
        cell: ({ row }) => (
          <span className="block text-right text-sm tabular-nums">
            {formatNumberFr(row.original.received)}
          </span>
        ),
      },
      {
        accessorKey: "sent",
        header: ({ column }) => (
          <SortHeader
            label="Envoyés"
            sorted={column.getIsSorted()}
            onToggle={() =>
              column.toggleSorting(column.getIsSorted() !== "desc")
            }
          />
        ),
        cell: ({ row }) => (
          <span className="block text-right text-sm tabular-nums">
            {formatNumberFr(row.original.sent)}
          </span>
        ),
      },
      {
        accessorKey: "lastActivityLabel",
        header: "Dernier échange",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {row.original.lastActivityLabel}
          </span>
        ),
      },
      {
        accessorKey: "instinct",
        header: "Instinct IA",
        enableSorting: false,
        cell: ({ row }) => (
          <InstinctCell classification={row.original.instinct} />
        ),
      },
      {
        accessorKey: "aiActive",
        header: "Réglage IA",
        enableSorting: false,
        cell: ({ row }) => <AiBadge active={row.original.aiActive} />,
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <Button
            asChild
            variant="outline"
            size="sm"
            className="ml-auto flex w-fit"
          >
            <Link
              href={chatHref(projectId, row.original.id)}
              aria-label={`Ouvrir la discussion avec ${row.original.name}`}
            >
              <MessageSquare data-icon="inline-start" />
              Discuter
            </Link>
          </Button>
        ),
      },
    ],
    [projectId],
  );

  const table = useReactTable({
    data,
    columns,
    state: { globalFilter: query, sorting },
    onGlobalFilterChange: setQuery,
    onSortingChange: setSorting,
    globalFilterFn: (row, _columnId, value: string) => {
      const needle = value.trim().toLowerCase();
      if (!needle) return true;
      return `${row.original.name} ${row.original.phone}`
        .toLowerCase()
        .includes(needle);
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  const rows = table.getRowModel().rows;

  return (
    <AnalyticsCard
      title="Contacts les plus actifs"
      description={`Jusqu’à 15 contacts, classés par volume d’échanges · ${rangeLabel}`}
      aside={
        <Button
          asChild
          variant="outline"
          size="sm"
          className="w-full sm:w-auto"
        >
          <Link href={`/projects/${encodeURIComponent(projectId)}/contacts`}>
            Tous les contacts
            <ArrowUpRight data-icon="inline-end" />
          </Link>
        </Button>
      }
    >
      {contacts.length === 0 ? (
        <ChartEmptyState
          icon={MessageSquareOff}
          title="Aucun contact actif"
          description="Les contacts ayant échangé des messages pendant la période apparaîtront ici."
        />
      ) : (
        // Bascule selon la largeur de la carte, pas de l’écran : avec la barre
        // latérale, la carte est bien plus étroite que la fenêtre.
        <div className="@container/top-contacts space-y-3">
          <InputGroup className="@md/top-contacts:max-w-xs">
            <InputGroupAddon align="inline-start">
              <Search aria-hidden="true" />
            </InputGroupAddon>
            <InputGroupInput
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher un contact…"
              aria-label="Rechercher parmi les contacts les plus actifs"
              autoComplete="off"
              maxLength={80}
            />
            {query && (
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  size="icon-xs"
                  aria-label="Effacer la recherche"
                  onClick={() => setQuery("")}
                >
                  <X />
                </InputGroupButton>
              </InputGroupAddon>
            )}
          </InputGroup>

          <p role="status" className="sr-only">
            {rows.length} contact{rows.length > 1 ? "s" : ""} affiché
            {rows.length > 1 ? "s" : ""}
          </p>

          {rows.length === 0 ? (
            <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
              Aucun contact ne correspond à « {query.trim()} ».
            </p>
          ) : (
            <>
              {/* Carte étroite : une fiche par contact. */}
              <ul className="divide-y rounded-xl border @4xl/top-contacts:hidden">
                {rows.map((row) => {
                  const contact = row.original;
                  return (
                    <li key={row.id} className="p-3 sm:p-4">
                      <div className="flex items-center gap-3">
                        <span className="w-4 shrink-0 text-xs tabular-nums text-muted-foreground">
                          {contact.rank}
                        </span>
                        <Avatar className="size-9 shrink-0 border">
                          <AvatarFallback className="bg-muted/60 text-xs font-medium">
                            {getInitials(contact.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {contact.name}
                          </p>
                          <p className="truncate text-xs tabular-nums text-muted-foreground">
                            {contact.phone}
                          </p>
                        </div>
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="shrink-0"
                        >
                          <Link
                            href={chatHref(projectId, contact.id)}
                            aria-label={`Ouvrir la discussion avec ${contact.name}`}
                          >
                            <MessageSquare data-icon="inline-start" />
                            <span className="@max-xs/top-contacts:sr-only">
                              Discuter
                            </span>
                          </Link>
                        </Button>
                      </div>
                      <div className="mt-3 space-y-2.5 pl-7">
                        <dl className="grid grid-cols-2 gap-2">
                          {[
                            ["Reçus", contact.received],
                            ["Envoyés", contact.sent],
                          ].map(([label, value]) => (
                            <div
                              key={label}
                              className="rounded-lg bg-muted/50 px-3 py-2"
                            >
                              <dt className="text-[11px] text-muted-foreground">
                                {label}
                              </dt>
                              <dd className="text-sm font-semibold tabular-nums">
                                {formatNumberFr(Number(value))}
                              </dd>
                            </div>
                          ))}
                        </dl>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                          <InstinctCell classification={contact.instinct} />
                          <AiBadge active={contact.aiActive} />
                          <span className="ml-auto whitespace-nowrap text-[11px] text-muted-foreground">
                            {contact.lastActivityLabel}
                          </span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>

              {/* Carte large : tableau complet. */}
              <div className="hidden overflow-x-auto rounded-xl border @4xl/top-contacts:block">
                <Table>
                  <TableCaption className="sr-only">
                    Contacts les plus actifs, classés par volume d’échanges.
                    Dates locales.
                  </TableCaption>
                  <TableHeader>
                    {table.getHeaderGroups().map((group) => (
                      <TableRow key={group.id} className="hover:bg-transparent">
                        {group.headers.map((header) => (
                          <TableHead
                            key={header.id}
                            aria-sort={
                              header.column.getIsSorted() === "asc"
                                ? "ascending"
                                : header.column.getIsSorted() === "desc"
                                  ? "descending"
                                  : undefined
                            }
                            className={cn(
                              "h-10 text-xs",
                              (header.column.id === "received" ||
                                header.column.id === "sent") &&
                                "text-right",
                              header.column.id === "rank" && "w-8",
                              header.column.id === "lastActivityLabel" &&
                                "hidden @5xl/top-contacts:table-cell",
                            )}
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
                    {rows.map((row) => (
                      <TableRow key={row.id} className="hover:bg-muted/30">
                        {row.getVisibleCells().map((cell) => (
                          <TableCell
                            key={cell.id}
                            className={cn(
                              "py-2.5",
                              cell.column.id === "contact" && "max-w-56",
                              cell.column.id === "lastActivityLabel" &&
                                "hidden @5xl/top-contacts:table-cell",
                            )}
                          >
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext(),
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>
      )}
    </AnalyticsCard>
  );
}
