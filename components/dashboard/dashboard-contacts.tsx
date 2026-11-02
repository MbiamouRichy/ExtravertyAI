import prisma from "@/lib/prisma";

import { Button } from "@/components/ui/button";
import { ArrowRightIcon, Bot, User, Users } from "lucide-react";
import Link from "next/link";
import { maskContactPhone } from "@/lib/contact-details";
import { AnalyticsCard } from "./analytics-card";
import { ChartEmptyState } from "./chart-empty-state";

export async function DashboardContacts({ projectId }: { projectId: string }) {
  const recentContacts = await prisma.contact.findMany({
    where: { projectId },
    orderBy: [
      { lastMessageAt: { sort: "desc", nulls: "last" } },
      { createdAt: "desc" },
      { id: "desc" },
    ],
    take: 5,
    select: {
      id: true,
      name: true,
      pushName: true,
      phone: true,
      aiActive: true,
    },
  });

  return (
    <AnalyticsCard
      title="Derniers prospects"
      description="Contacts WhatsApp récemment actifs"
      aside={
        <Button asChild variant="ghost" size="sm" className="-mt-1 -mr-2">
          <Link href={`/projects/${projectId}/contacts`}>
            Voir tout le CRM
            <ArrowRightIcon data-icon="inline-end" aria-hidden="true" />
          </Link>
        </Button>
      }
    >
      {recentContacts.length === 0 ? (
        <ChartEmptyState
          icon={Users}
          title="Aucun contact pour le moment"
          description="Vos prospects apparaîtront ici dès leur premier message."
        />
      ) : (
        <ul aria-label="Derniers contacts WhatsApp" className="divide-y">
          {recentContacts.map((contact) => (
            <li
              key={contact.id}
              className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {contact.name || contact.pushName || "Inconnu"}
                  {!contact.name && contact.pushName && (
                    <span className="ml-2 hidden text-xs font-normal text-muted-foreground sm:inline">
                      (WhatsApp)
                    </span>
                  )}
                </p>
                <p className="mt-0.5 truncate text-xs tabular-nums text-muted-foreground">
                  {maskContactPhone(contact.phone) ?? "Numéro indisponible"}
                </p>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                {contact.aiActive ? (
                  <>
                    <Bot aria-hidden="true" className="size-3.5" /> IA
                  </>
                ) : (
                  <>
                    <User aria-hidden="true" className="size-3.5" /> Agent
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </AnalyticsCard>
  );
}
