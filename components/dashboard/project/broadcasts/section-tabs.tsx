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
  tabs: Array<{ id: string; label: string; count?: number; content: ReactNode }>;
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
      <div className="-mx-4 overflow-x-auto overflow-y-hidden px-4 sm:mx-0 sm:px-0">
        <TabsList aria-label={label}>
          {tabs.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id}>
              {tab.label}
              {tab.count !== undefined && (
                <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                  {tab.count.toLocaleString("fr-FR")}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {tabs.map((tab) => (
        <TabsContent key={tab.id} value={tab.id} className="mt-6">
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
