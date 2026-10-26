"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Download, FileSpreadsheet, Loader2, Package, Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { importProductsCsvAction } from "@/app/actions/knowledge";
import { KNOWLEDGE_LIMITS, normalizeSearchText } from "@/lib/knowledge-shared";
import { formatDealValue } from "@/lib/pipeline-shared";
import { cn } from "@/lib/utils";
import { EntryActions } from "./entry-actions";
import { EntryFormDialog } from "./entry-form";
import type { KnowledgeEntryView } from "./types";

const TEMPLATE = "nom;prix;stock;description\nSneakers Urban blanches;45000;3;Cuir, pointures 38 à 45\n";

export function KnowledgeProducts({
  projectId,
  currency,
  products,
  onChanged,
}: {
  projectId: string;
  currency: string;
  products: KnowledgeEntryView[];
  onChanged: () => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<KnowledgeEntryView | "new" | null>(null);
  const [importing, startImport] = useTransition();

  const visible = useMemo(() => {
    const needle = normalizeSearchText(query);
    return needle
      ? products.filter((product) => normalizeSearchText(`${product.title} ${product.content}`).includes(needle))
      : products;
  }, [products, query]);

  function importFile(file: File) {
    if (file.size > KNOWLEDGE_LIMITS.csvMaxBytes) {
      toast.error("Le fichier CSV dépasse 2 Mo.");
      return;
    }
    startImport(async () => {
      const result = await importProductsCsvAction({
        projectId,
        fileName: file.name,
        text: await file.text(),
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(`${result.imported.toLocaleString("fr-FR")} produit(s) importé(s)`, {
        description: result.skipped
          ? `${result.skipped} ligne(s) ignorée(s)${result.truncated ? " : limite de votre offre atteinte" : ""}. ${result.errors.slice(0, 2).join(" ")}`
          : undefined,
      });
      onChanged();
    });
  }

  // Action principale d’abord ; même hauteur pour les trois boutons.
  // Catalogue vide : centrés (empilés pleine largeur sur mobile) ;
  // sinon alignés à droite de la recherche.
  const renderActions = (placement: "toolbar" | "empty") => (
    <div
      className={
        placement === "empty"
          ? "flex w-full flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center"
          : "flex flex-wrap items-center gap-2 lg:justify-end"
      }
    >
      <Button type="button" onClick={() => setEditing("new")}>
        <Plus data-icon="inline-start" />
        Ajouter un produit
      </Button>
      <Button type="button" variant="outline" disabled={importing} onClick={() => fileInput.current?.click()}>
        {importing ? (
          <Loader2 data-icon="inline-start" className="animate-spin motion-reduce:animate-none" />
        ) : (
          <FileSpreadsheet data-icon="inline-start" />
        )}
        {importing ? "Import en cours…" : "Importer un CSV"}
      </Button>
      <Button asChild variant="ghost">
        <a href={`data:text/csv;charset=utf-8,${encodeURIComponent("﻿" + TEMPLATE)}`} download="modele-catalogue.csv">
          <Download data-icon="inline-start" />
          Modèle CSV
        </a>
      </Button>
      <input
        ref={fileInput}
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) importFile(file);
        }}
      />
    </div>
  );

  return (
    <div className="space-y-4">
      {products.length > 0 && (
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <InputGroup className="lg:max-w-xs">
            <InputGroupAddon>
              <Search aria-hidden="true" />
            </InputGroupAddon>
            <InputGroupInput
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher un produit"
              aria-label="Rechercher un produit"
            />
          </InputGroup>
          {renderActions("toolbar")}
        </div>
      )}

      {products.length === 0 ? (
        <Empty className="rounded-2xl border border-dashed p-10">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Package aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>Ajoutez votre catalogue</EmptyTitle>
            <EmptyDescription>
              Importez un fichier CSV (nom, prix, stock, description) exporté de
              votre tableur, ou ajoutez vos produits un par un. L’assistant cite
              alors les bons prix et les stocks à jour.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent className="max-w-xl">{renderActions("empty")}</EmptyContent>
        </Empty>
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produit</TableHead>
                <TableHead className="text-right">Prix</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="w-36 text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((product) => (
                <TableRow key={product.id} className={cn(!product.enabled && "opacity-60")}>
                  <TableCell className="max-w-80">
                    <p className="truncate font-medium">{product.title}</p>
                    {product.content !== product.title && (
                      <p className="truncate text-xs text-muted-foreground">{product.content}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums">
                    {product.price !== null ? formatDealValue(product.price, currency) : "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums">
                    {product.stock === null ? "—" : product.stock === 0 ? "Rupture" : product.stock.toLocaleString("fr-FR")}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <EntryActions
                        projectId={projectId}
                        entryId={product.id}
                        title={product.title}
                        enabled={product.enabled}
                        onEdit={() => setEditing(product)}
                        onChanged={onChanged}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {visible.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                    Aucun produit ne correspond à « {query} ».
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {editing && (
        <EntryFormDialog
          key={editing === "new" ? "new-product" : editing.id}
          open
          onOpenChange={(open) => !open && setEditing(null)}
          projectId={projectId}
          kind="PRODUCT"
          currency={currency}
          entry={editing === "new" ? null : editing}
          onSaved={onChanged}
        />
      )}
    </div>
  );
}
