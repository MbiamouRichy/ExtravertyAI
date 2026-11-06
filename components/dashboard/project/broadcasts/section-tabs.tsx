"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/**
 * Page sections as tabs. The open tab is kept in « ?vue= » (an identifier,
 * never personal data) so a link or a refresh opens the same section.
 */
export function SectionTabs({
  tabs,
  label,
}: {
  label: string;
  /** shortLabel : libellé affiché sous 400 px de large. */
  tabs: Array<{
    id: string;
    label: string;
    shortLabel?: string;
    count?: number;
    content: ReactNode;
  }>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const requested = params.get("vue");
  const current = tabs.some((tab) => tab.id === requested) ? requested! : tabs[0].id;

  function select(id: string) {
    const next = new URLSearchParams(params);
    if (id === tabs[0].id) next.delete("vue");
    else next.set("vue", id);
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return (
    <Tabs value={current} onValueChange={select}>
      {/* Mobile : barre pleine largeur à parts égales, libellé court et
          compteur dessous ; tout reste visible sans défilement caché. */}
      <TabsList
        aria-label={label}
        className="grid w-full group-data-horizontal/tabs:h-auto sm:inline-flex sm:w-fit sm:group-data-horizontal/tabs:h-9"
        style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
      >
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.id}
            value={tab.id}
            className="min-w-0 max-sm:h-auto max-sm:flex-col max-sm:gap-0 max-sm:px-1 max-sm:py-1.5 max-sm:text-xs"
          >
            {tab.shortLabel ? (
              <>
                <span className="truncate min-[400px]:hidden">{tab.shortLabel}</span>
                <span className="truncate max-[399px]:hidden">{tab.label}</span>
              </>
            ) : (
              <span className="truncate">{tab.label}</span>
            )}
            {tab.count !== undefined && (
              <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                {tab.count.toLocaleString("fr-FR")}
              </span>
            )}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((tab) => (
        <TabsContent key={tab.id} value={tab.id} className="mt-4">
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
