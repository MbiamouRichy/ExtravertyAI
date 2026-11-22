"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, FileText, Hash, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { searchHelpIndex, type HelpSearchEntry } from "@/lib/help-center/search";
import { cn } from "@/lib/utils";

/** Raccourci affiché selon la plateforme, connue seulement après le montage. */
function useShortcutLabel() {
  const [label, setLabel] = useState("Ctrl K");
  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.platform)) setLabel("⌘ K");
  }, []);
  return label;
}

function isTypingTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

/**
 * Recherche du centre d’aide : Ctrl/⌘ + K ou « / » l’ouvrent, les flèches
 * parcourent les résultats, Entrée ouvre le résultat choisi.
 */
export function HelpSearch({
  index,
  suggestions,
  variant = "bar",
}: {
  index: HelpSearchEntry[];
  suggestions: HelpSearchEntry[];
  variant?: "bar" | "icon" | "hero";
}) {
  const router = useRouter();
  const id = useId();
  const listId = `${id}-results`;
  const shortcut = useShortcutLabel();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const results = useMemo(() => (query.trim() ? searchHelpIndex(index, query) : suggestions), [index, query, suggestions]);
  const searching = query.trim().length > 0;

  useEffect(() => {
    // Un seul écouteur global : la variante principale (barre d’en-tête).
    if (variant !== "bar") return;
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      } else if (event.key === "/" && !isTypingTarget(event.target)) {
        event.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [variant]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function changeOpen(next: boolean) {
    setOpen(next);
    if (!next) {
      setQuery("");
      setActive(0);
    }
  }

  function go(entry: HelpSearchEntry | undefined) {
    if (!entry) return;
    changeOpen(false);
    router.push(entry.href);
  }

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((current) => (results.length ? (current + 1) % results.length : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((current) => (results.length ? (current - 1 + results.length) % results.length : 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      go(results[active]);
    }
  }

  const trigger =
    variant === "icon" ? (
      <Button type="button" variant="ghost" size="icon" onClick={() => setOpen(true)}>
        <Search />
        <span className="sr-only">Rechercher dans l’aide</span>
      </Button>
    ) : (
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        className={cn(
          "justify-start gap-2 font-normal text-muted-foreground",
          variant === "hero" ? "h-12 w-full rounded-xl px-4 text-base" : "h-9 w-full max-w-sm",
        )}
      >
        <Search data-icon="inline-start" />
        <span className="flex-1 truncate text-left">
          {variant === "hero" ? "Rechercher : QR code, essai, connaissances…" : "Rechercher dans l’aide…"}
        </span>
        <Kbd className="hidden sm:inline-flex">{shortcut}</Kbd>
      </Button>
    );

  return (
    <>
      {trigger}
      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogContent
          showCloseButton={false}
          className="top-4 translate-y-0 gap-0 overflow-hidden p-0 sm:top-[12vh] sm:max-w-xl"
        >
          <DialogTitle className="sr-only">Rechercher dans l’aide</DialogTitle>
          <DialogDescription className="sr-only">
            Tapez quelques mots, parcourez les résultats avec les flèches et ouvrez-en un avec Entrée.
          </DialogDescription>
          <div className="flex items-center gap-2 border-b px-3">
            <Search aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            <Input
              autoFocus
              type="search"
              role="combobox"
              aria-expanded={results.length > 0}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={results.length ? `${id}-option-${active}` : undefined}
              aria-label="Rechercher dans l’aide"
              placeholder="QR code, essai gratuit, reprendre la main…"
              autoComplete="off"
              spellCheck={false}
              maxLength={80}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
              onKeyDown={onInputKeyDown}
              className="h-12 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0 dark:bg-transparent"
            />
            <Kbd className="hidden sm:inline-flex">Échap</Kbd>
          </div>
          <div className="max-h-[60dvh] overflow-y-auto p-2">
            <p className="px-2 pt-1 pb-2 text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
              {searching ? `${results.length} résultat${results.length > 1 ? "s" : ""}` : "Les plus consultés"}
            </p>
            {results.length > 0 ? (
              <ul ref={listRef} id={listId} role="listbox" aria-label="Résultats" className="grid gap-0.5">
                {results.map((entry, position) => {
                  const selected = position === active;
                  const Icon = entry.href.includes("#") ? Hash : FileText;
                  return (
                    <li
                      key={entry.href}
                      id={`${id}-option-${position}`}
                      data-index={position}
                      role="option"
                      aria-selected={selected}
                      onMouseMove={() => setActive(position)}
                      onClick={() => go(entry)}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2",
                        selected ? "bg-muted text-foreground" : "text-muted-foreground",
                      )}
                    >
                      <Icon aria-hidden="true" className="size-4 shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">{entry.title}</span>
                        <span className="block truncate text-xs">{entry.context}</span>
                      </span>
                      {selected && <CornerDownLeft aria-hidden="true" className="size-3.5 shrink-0" />}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div role="status" className="px-2 py-8 text-center">
                <p className="text-sm font-medium text-foreground">Aucun résultat pour « {query.trim()} »</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Essayez un autre mot, par exemple « QR code », « forfait » ou « équipe ».
                </p>
              </div>
            )}
          </div>
          <div className="hidden items-center gap-4 border-t px-4 py-2.5 text-[11px] text-muted-foreground sm:flex">
            <span className="flex items-center gap-1.5">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd>
              naviguer
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd>Entrée</Kbd>
              ouvrir
            </span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
