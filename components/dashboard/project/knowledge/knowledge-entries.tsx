"use client";

import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { normalizeSearchText } from "@/lib/knowledge-shared";
import { cn } from "@/lib/utils";
import { EntryActions } from "./entry-actions";
import { EntryFormDialog } from "./entry-form";
import type { KnowledgeEntryView } from "./types";

export function KnowledgeEntries({
  projectId,
  currency,
  entries,
  onChanged,
}: {
  projectId: string;
  currency: string;
  entries: KnowledgeEntryView[];
  onChanged: () => void;
}) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<{ entry: KnowledgeEntryView | null } | null>(null);

  const visible = useMemo(() => {
    const needle = normalizeSearchText(query);
    return needle
      ? entries.filter((entry) => normalizeSearchText(`${entry.title} ${entry.content}`).includes(needle))
      : entries;
  }, [entries, query]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <InputGroup className="sm:max-w-xs">
          <InputGroupAddon>
            <Search aria-hidden="true" />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher"
            aria-label="Rechercher dans les informations"
          />
        </InputGroup>
        <Button type="button" className="w-full sm:w-auto" onClick={() => setEditing({ entry: null })}>
          <Plus data-icon="inline-start" />
          Information
        </Button>
      </div>

      {visible.length ? (
        <ul aria-label="Informations" className="divide-y rounded-xl border">
          {visible.map((entry) => (
            <li key={entry.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:gap-4">
              <div className={cn("min-w-0 flex-1", !entry.enabled && "opacity-60")}>
                <p className="text-sm font-medium">{entry.title}</p>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{entry.content}</p>
                {!entry.enabled && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Désactivée : l’assistant l’ignore.
                  </p>
                )}
              </div>
              <EntryActions
                projectId={projectId}
                entryId={entry.id}
                title={entry.title}
                enabled={entry.enabled}
                onEdit={() => setEditing({ entry })}
                onChanged={onChanged}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">
          {query ? "Aucun résultat." : "Horaires, livraison, paiement, questions fréquentes…"}
        </p>
      )}

      {editing && (
        <EntryFormDialog
          key={editing.entry?.id ?? "new"}
          open
          onOpenChange={(open) => !open && setEditing(null)}
          projectId={projectId}
          // Les anciennes questions gardent leur type : seul l’affichage est réuni.
          kind={editing.entry?.kind === "FAQ" ? "FAQ" : "TEXT"}
          currency={currency}
          entry={editing.entry}
          onSaved={onChanged}
        />
      )}
    </div>
  );
}
