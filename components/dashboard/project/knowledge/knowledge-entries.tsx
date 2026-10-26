"use client";

import { useMemo, useState } from "react";
import { FileText, MessageCircleQuestion, Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Empty,
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
  const [editing, setEditing] = useState<{ kind: "FAQ" | "TEXT"; entry: KnowledgeEntryView | null } | null>(null);

  const visible = useMemo(() => {
    const needle = normalizeSearchText(query);
    return needle
      ? entries.filter((entry) => normalizeSearchText(`${entry.title} ${entry.content}`).includes(needle))
      : entries;
  }, [entries, query]);

  const groups = [
    { kind: "FAQ" as const, title: "Questions fréquentes", icon: MessageCircleQuestion, empty: "Ajoutez les questions que vos clients posent le plus souvent." },
    { kind: "TEXT" as const, title: "Informations", icon: FileText, empty: "Horaires, livraison, retours, moyens de paiement…" },
  ];

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
            placeholder="Rechercher une entrée"
            aria-label="Rechercher dans les questions et informations"
          />
        </InputGroup>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => setEditing({ kind: "TEXT", entry: null })}>
            <Plus data-icon="inline-start" />
            Information
          </Button>
          <Button type="button" onClick={() => setEditing({ kind: "FAQ", entry: null })}>
            <Plus data-icon="inline-start" />
            Question
          </Button>
        </div>
      </div>

      {groups.map((group) => {
        const items = visible.filter((entry) => entry.kind === group.kind);
        const Icon = group.icon;
        return (
          <section key={group.kind} aria-labelledby={`knowledge-${group.kind}`}>
            <h2
              id={`knowledge-${group.kind}`}
              className="mb-3 flex items-center gap-2 font-mono text-[11px] font-normal uppercase tracking-wider text-muted-foreground"
            >
              <Icon aria-hidden="true" className="size-3.5" />
              {group.title}
              <span className="tabular-nums">· {items.length}</span>
            </h2>
            {items.length ? (
              <ul className="divide-y rounded-2xl border bg-card">
                {items.map((entry) => (
                  <li key={entry.id} className="flex items-start gap-4 p-4">
                    <div className={cn("min-w-0 flex-1", !entry.enabled && "opacity-60")}>
                      <p className="text-sm font-medium">{entry.title}</p>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{entry.content}</p>
                      {!entry.enabled && (
                        <p className="mt-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                          Désactivée · ignorée par l’assistant
                        </p>
                      )}
                    </div>
                    <EntryActions
                      projectId={projectId}
                      entryId={entry.id}
                      title={entry.title}
                      enabled={entry.enabled}
                      onEdit={() => setEditing({ kind: group.kind, entry })}
                      onChanged={onChanged}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <Empty className="rounded-2xl border border-dashed p-8">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Icon aria-hidden="true" />
                  </EmptyMedia>
                  <EmptyTitle className="text-sm">{query ? "Aucun résultat" : "Rien pour l’instant"}</EmptyTitle>
                  <EmptyDescription>{query ? "Essayez d’autres mots." : group.empty}</EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </section>
        );
      })}

      {editing && (
        <EntryFormDialog
          key={editing.entry?.id ?? `new-${editing.kind}`}
          open
          onOpenChange={(open) => !open && setEditing(null)}
          projectId={projectId}
          kind={editing.kind}
          currency={currency}
          entry={editing.entry}
          onSaved={onChanged}
        />
      )}
    </div>
  );
}
