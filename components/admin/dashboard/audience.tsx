"use client";

import { Tabs as TabsPrimitive } from "radix-ui";

import type { ShareRow } from "@/lib/admin-dashboard";
import { BarList } from "./bar-list";
import { DashboardCard } from "./card";

const countryName = new Intl.DisplayNames(["fr"], { type: "region" });
const country = (code: string) => (/^[A-Z]{2}$/.test(code) ? (countryName.of(code) ?? code) : code);
const DEVICE_LABEL: Record<string, string> = {
  mobile: "Mobile",
  desktop: "Ordinateur",
  tablet: "Tablette",
};
const device = (label: string) => DEVICE_LABEL[label] ?? label;

/** D’où viennent les visiteurs et ce qu’ils lisent : un classement à la fois. */
export function AudienceCard({
  id,
  countries,
  pages,
  referrers,
  devices,
  browsers,
}: {
  id: string;
  countries: ShareRow[];
  pages: ShareRow[];
  referrers: ShareRow[];
  devices: ShareRow[];
  browsers: ShareRow[];
}) {
  const tabs = [
    {
      value: "countries",
      label: "Pays",
      note: "Part des visiteurs",
      content: <BarList rows={countries} valueLabel="Visiteurs" formatLabel={country} />,
    },
    {
      value: "pages",
      label: "Pages",
      note: "Site vitrine, part des pages vues",
      content: <BarList rows={pages} valueLabel="Pages vues" mono />,
    },
    {
      value: "sources",
      label: "Sources",
      note: "Sites d’où arrivent les visiteurs",
      content: <BarList rows={referrers} valueLabel="Visiteurs" mono />,
    },
    {
      value: "devices",
      label: "Appareils",
      note: "Appareils puis navigateurs, part des visiteurs",
      content: (
        <div className="space-y-5">
          <BarList rows={devices} valueLabel="Visiteurs" formatLabel={device} />
          <div>
            <h3 className="mb-1.5 text-xs font-medium text-muted-foreground">Navigateurs</h3>
            <BarList rows={browsers} valueLabel="Visiteurs" />
          </div>
        </div>
      ),
    },
  ];
  return (
    <DashboardCard id={id} title="Audience">
      <TabsPrimitive.Root defaultValue="countries" className="flex flex-1 flex-col">
        {/* Onglets soulignés : ils passent à la ligne au besoin, jamais de défilement caché. */}
        <TabsPrimitive.List
          aria-labelledby={`${id}-title`}
          className="flex flex-wrap gap-x-5 border-b px-4 sm:px-5"
        >
          {tabs.map((tab) => (
            <TabsPrimitive.Trigger
              key={tab.value}
              value={tab.value}
              className="relative -mb-px cursor-pointer border-b-2 border-transparent py-2.5 text-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring data-[state=active]:border-foreground data-[state=active]:font-medium data-[state=active]:text-foreground"
            >
              {tab.label}
            </TabsPrimitive.Trigger>
          ))}
        </TabsPrimitive.List>
        {tabs.map((tab) => (
          <TabsPrimitive.Content
            key={tab.value}
            value={tab.value}
            className="flex-1 p-4 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:p-5"
          >
            <p className="mb-3 text-xs text-muted-foreground">{tab.note}</p>
            {tab.content}
          </TabsPrimitive.Content>
        ))}
      </TabsPrimitive.Root>
    </DashboardCard>
  );
}
