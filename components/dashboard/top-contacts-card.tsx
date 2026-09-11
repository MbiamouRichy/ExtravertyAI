import { Bot, MessageSquareOff, User } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

import { AnalyticsCard } from "./analytics-card";
import { ChartEmptyState } from "./chart-empty-state";
import { cn } from "@/lib/utils";
import { formatNumberFr, type TopContactRow } from "@/lib/analytics";

function getInitials(name: string): string {
    return (
        name
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map((part) => part.charAt(0).toUpperCase())
            .join("") || "?"
    );
}

function AiBadge({ active }: { active: boolean }) {
    const Icon = active ? Bot : User;

    return (
        <Badge
            variant="outline"
            className={cn(
                "gap-1.5 whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-medium",
                active
                    ? "border-primary/20 bg-primary/5 text-primary"
                    : "border-border bg-muted/40 text-muted-foreground",
            )}
        >
            <Icon aria-hidden="true" className="size-3" />
            {active ? "IA activée" : "IA désactivée"}
        </Badge>
    );
}

interface TopContactsCardProps {
    contacts: TopContactRow[];
    rangeLabel: string;
}

export function TopContactsCard({
    contacts,
    rangeLabel,
}: TopContactsCardProps) {
    return (
        <AnalyticsCard
            title="Contacts les plus actifs"
            description={`Jusqu’à 5 contacts, classés par volume d’échanges · ${rangeLabel}`}
            footer="Téléphones partiellement masqués. Le réglage IA affiché est le réglage actuel du contact."
        >
            {contacts.length === 0 ? (
                <ChartEmptyState
                    icon={MessageSquareOff}
                    title="Aucun contact actif"
                    description="Les contacts ayant échangé des messages pendant la période apparaîtront ici."
                />
            ) : (
                <Table className="table-fixed">
                    <TableCaption className="sr-only">
                        Contacts classés par nombre de messages reçus et
                        envoyés. Dates en UTC.
                    </TableCaption>

                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="w-1/2 text-xs">
                                Contact
                            </TableHead>
                            <TableHead className="w-16 text-right text-xs sm:w-20">
                                Reçus
                            </TableHead>
                            <TableHead className="w-16 text-right text-xs sm:w-20">
                                Envoyés
                            </TableHead>
                            <TableHead className="hidden w-32 text-right text-xs md:table-cell">
                                Réglage IA
                            </TableHead>
                        </TableRow>
                    </TableHeader>

                    <TableBody>
                        {contacts.map((contact, index) => (
                            <TableRow
                                key={contact.id}
                                className="hover:bg-muted/30"
                            >
                                <TableCell className="py-4 align-top whitespace-normal">
                                    <div className="flex min-w-0 items-start gap-2 sm:gap-3">
                                        <span
                                            aria-hidden="true"
                                            className="hidden w-3 pt-2 text-xs tabular-nums text-muted-foreground sm:block"
                                        >
                                            {index + 1}
                                        </span>

                                        <Avatar className="hidden size-9 shrink-0 border sm:flex">
                                            <AvatarFallback className="bg-muted/60 text-xs font-medium">
                                                {getInitials(contact.name)}
                                            </AvatarFallback>
                                        </Avatar>

                                        <div className="min-w-0 flex-1">
                                            <span className="block break-words text-sm font-medium">
                                                {contact.name}
                                            </span>

                                            <span className="mt-1 block text-xs tabular-nums text-muted-foreground">
                                                {contact.phone}
                                            </span>

                                            <details className="mt-2 text-xs">
                                                <summary className="w-fit cursor-pointer rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                                    Détails
                                                </summary>

                                                <div className="mt-2 space-y-2 text-muted-foreground">
                                                    <p className="leading-relaxed">
                                                        Dernier message :{" "}
                                                        {contact.lastActivityLabel}
                                                        {" "}· UTC
                                                    </p>

                                                    <div className="md:hidden">
                                                        <AiBadge
                                                            active={
                                                                contact.aiActive
                                                            }
                                                        />
                                                    </div>
                                                </div>
                                            </details>
                                        </div>
                                    </div>
                                </TableCell>

                                <TableCell className="py-4 text-right align-top text-sm tabular-nums">
                                    {formatNumberFr(contact.received)}
                                </TableCell>

                                <TableCell className="py-4 text-right align-top text-sm tabular-nums">
                                    {formatNumberFr(contact.sent)}
                                </TableCell>

                                <TableCell className="hidden py-4 text-right align-top md:table-cell">
                                    <AiBadge active={contact.aiActive} />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}
        </AnalyticsCard>
    );
}