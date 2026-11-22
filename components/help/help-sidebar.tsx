"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, House } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { HelpNavGroup } from "@/lib/help-center/articles";
import { cn } from "@/lib/utils";

/**
 * Arborescence du centre d’aide, en accordéon. La rubrique de l’article
 * ouvert est dépliée ; les autres restent à un clic.
 */
export function HelpSidebar({ groups, onNavigate }: { groups: HelpNavGroup[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  const currentSlug = pathname.startsWith("/aide/") ? pathname.slice("/aide/".length).split("/")[0] : null;
  const currentGroup = groups.find((group) => group.articles.some((article) => article.slug === currentSlug))?.id;
  const [openGroups, setOpenGroups] = useState<Set<string>>(
    () => new Set([groups[0]?.id, currentGroup].filter((id): id is HelpNavGroup["id"] => Boolean(id))),
  );

  // Une navigation vers une autre rubrique la déplie, sans replier celles déjà ouvertes.
  const [seenGroup, setSeenGroup] = useState(currentGroup);
  if (currentGroup !== seenGroup) {
    setSeenGroup(currentGroup);
    if (currentGroup && !openGroups.has(currentGroup)) setOpenGroups(new Set(openGroups).add(currentGroup));
  }

  function toggle(id: string) {
    const next = new Set(openGroups);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setOpenGroups(next);
  }

  return (
    <nav aria-label="Rubriques de l’aide" className="grid gap-1 text-sm">
      <Link
        href="/aide"
        onClick={onNavigate}
        aria-current={pathname === "/aide" ? "page" : undefined}
        className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current=page]:bg-muted aria-[current=page]:font-medium aria-[current=page]:text-foreground"
      >
        <House aria-hidden="true" className="size-4" />
        Accueil de l’aide
      </Link>
      {groups.map((group) => {
        const open = openGroups.has(group.id);
        const panelId = `help-nav-${group.id}`;
        return (
          <div key={group.id} className="grid gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-expanded={open}
              aria-controls={panelId}
              onClick={() => toggle(group.id)}
              className="h-8 w-full justify-between px-2.5 text-xs font-semibold tracking-wide text-foreground uppercase"
            >
              {group.label}
              <ChevronRight
                aria-hidden="true"
                className={cn("transition-transform motion-reduce:transition-none", open && "rotate-90")}
              />
            </Button>
            <ul id={panelId} hidden={!open} className="ml-2.5 grid gap-0.5 border-l pl-2">
              {group.articles.map((article) => {
                const current = article.slug === currentSlug;
                return (
                  <li key={article.slug}>
                    <Link
                      href={`/aide/${article.slug}`}
                      onClick={onNavigate}
                      aria-current={current ? "page" : undefined}
                      className={cn(
                        "-ml-[9px] flex items-baseline gap-2 border-l-2 border-transparent py-1.5 pr-2 pl-3 leading-snug text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
                        current && "border-foreground font-medium text-foreground",
                      )}
                    >
                      <span className="min-w-0 flex-1">{article.title}</span>
                      {article.plan && (
                        <span className="shrink-0 rounded-full border px-1.5 text-[10px] font-normal text-muted-foreground">
                          {article.plan === "Business" ? "Business" : "Pro+"}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
