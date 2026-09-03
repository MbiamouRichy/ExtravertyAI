"use client";

import * as React from "react"
import {
    ColumnDef,
    flexRender,
    getCoreRowModel,
    useReactTable,
    SortingState,
    getSortedRowModel,
    ColumnFiltersState,
    VisibilityState,
    getPaginationRowModel,
    getFilteredRowModel
} from "@tanstack/react-table"

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Settings2, Search, ChevronLeft, ChevronRight, Download, ChevronDown, SheetIcon, NotepadTextIcon } from "lucide-react"
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { handleExport } from "@/lib/exportFile";



interface ContactsTableProps<TData, TValue> {
    columns: ColumnDef<TData, TValue>[]
    data: TData[]
}

export function ContactsTable<TData, TValue>({
    columns,
    data,
}: ContactsTableProps<TData, TValue>) {
    const [sorting, setSorting] = React.useState<SortingState>([])
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
    const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
    const [isMobile, setIsMobile] = React.useState(false)

    // 🚀 La magie opère ici : On détecte le mobile pour l'UX
    React.useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 768);
        };

        handleResize(); // Vérification initiale

        // Sur mobile, on cache tout par défaut sauf l'identité et les actions
        if (window.innerWidth < 768) {
            setColumnVisibility({
                phone: false,
                aiActive: false,
                createdAt: false,
            });
        }

        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    // eslint-disable-next-line react-hooks/incompatible-library
    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        onSortingChange: setSorting,
        getSortedRowModel: getSortedRowModel(),
        onColumnFiltersChange: setColumnFilters,
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        onColumnVisibilityChange: setColumnVisibility, // TanStack contrôle la vue
        state: {
            sorting,
            columnFilters,
            columnVisibility, // La visibilité est gérée ici
        },
        initialState: {
            pagination: {
                pageSize: 10,
            },
        },
    })




    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="relative w-full max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Rechercher un numéro..."
                        value={(table.getColumn("phone")?.getFilterValue() as string) ?? ""}
                        onChange={(event) =>
                            table.getColumn("phone")?.setFilterValue(event.target.value)
                        }
                        className="pl-9 bg-background"
                    />
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <DropdownMenu>
                        <DropdownMenuTrigger>
                            <Button
                                variant="outline"
                                className="flex-1 sm:flex-none flex items-center gap-2 bg-background"
                            >
                                <Download className="h-4 w-4" />
                                <span className="hidden sm:inline">Exporter</span>
                                <ChevronDown className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuLabel>Exporter vers</DropdownMenuLabel>
                            <DropdownMenuItem className="cursor-pointer" onClick={() => handleExport("csv", table)}>
                                <NotepadTextIcon />
                                Exporter (CSV)
                            </DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer" onClick={() => handleExport("pdf", table)}>
                                <SheetIcon />
                                Exporter (PDF)
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>


                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="flex-1 sm:flex-none flex items-center gap-2 bg-background">
                                <Settings2 className="h-4 w-4" />
                                <span className="hidden sm:inline">Colonnes</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-37.5">
                            {table
                                .getAllColumns()
                                .filter((column) => column.getCanHide())
                                .map((column) => {
                                    return (
                                        <DropdownMenuCheckboxItem
                                            key={column.id}
                                            className="capitalize"
                                            checked={column.getIsVisible()}
                                            onCheckedChange={(value) => {
                                                // 💡 LOGIQUE UX RESPONSIVE DYNAMIQUE
                                                if (isMobile) {
                                                    if (value) {
                                                        // Si on active une colonne sur mobile, on cache toutes les autres
                                                        const newVisibility: VisibilityState = {};
                                                        table.getAllColumns().forEach(col => {
                                                            if (col.getCanHide()) {
                                                                newVisibility[col.id] = col.id === column.id;
                                                            }
                                                        });
                                                        setColumnVisibility(newVisibility);
                                                    } else {
                                                        // Si on désactive la colonne, on remet le "Nom" par défaut
                                                        const newVisibility: VisibilityState = {};
                                                        table.getAllColumns().forEach(col => {
                                                            if (col.getCanHide()) {
                                                                newVisibility[col.id] = col.id === "name";
                                                            }
                                                        });
                                                        setColumnVisibility(newVisibility);
                                                    }
                                                } else {
                                                    // Comportement normal sur Ordinateur
                                                    column.toggleVisibility(!!value);
                                                }
                                            }}
                                        >
                                            {column.id === "phone" ? "Numéro" :
                                                column.id === "aiActive" ? "Statut IA" :
                                                    column.id === "createdAt" ? "Date" :
                                                        column.id === "name" ? "Identité" : column.id}
                                        </DropdownMenuCheckboxItem>
                                    )
                                })}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            <div className="border bg-card text-card-foreground shadow-sm overflow-hidden">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id} className="bg-muted/40 hover:bg-muted/40 border-b-neutral-200 dark:border-neutral-800">
                                {headerGroup.headers.map((header) => {
                                    return (
                                        <TableHead
                                            key={header.id}
                                            // FINI LES CLASSES TAILWIND "HIDDEN", TanStack GÈRE TOUT !
                                            className={`h-10 ${header.column.id === 'actions' ? 'text-right' : ''}`}
                                        >
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(
                                                    header.column.columnDef.header,
                                                    header.getContext()
                                                )}
                                        </TableHead>
                                    )
                                })}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow
                                    key={row.id}
                                    data-state={row.getIsSelected() && "selected"}
                                    className="transition-colors hover:bg-muted/30 border-b-neutral-200 dark:border-neutral-800"
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell
                                            key={cell.id}
                                            className={`py-3 ${cell.column.id === 'actions' ? 'text-right' : ''}`}
                                        >
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={columns.length} className="h-32 text-center text-muted-foreground">
                                    <div className="flex flex-col items-center justify-center gap-2">
                                        <Search className="h-6 w-6 text-muted-foreground/50" />
                                        <p>Aucun contact trouvé.</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination ... (le reste de ton code) */}
            <div className="flex items-center justify-between px-2 py-2">
                <div className="text-sm text-muted-foreground hidden sm:block">
                    Total : <span className="font-medium text-foreground">{table.getFilteredRowModel().rows.length}</span> prospect(s)
                </div>

                <div className="flex items-center space-x-6 lg:space-x-8">
                    <div className="flex w-fit items-center justify-center text-sm font-medium text-muted-foreground">
                        Page {table.getState().pagination.pageIndex + 1} sur{" "}
                        {table.getPageCount() || 1}
                    </div>
                    <div className="flex items-center space-x-2">
                        <Button
                            variant="outline"
                            className="h-8 w-8 p-0 bg-background"
                            onClick={() => table.previousPage()}
                            disabled={!table.getCanPreviousPage()}
                        >
                            <span className="sr-only">Page précédente</span>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="outline"
                            className="h-8 w-8 p-0 bg-background"
                            onClick={() => table.nextPage()}
                            disabled={!table.getCanNextPage()}
                        >
                            <span className="sr-only">Page suivante</span>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}