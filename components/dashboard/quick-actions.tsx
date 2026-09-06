import {
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Item,
    ItemActions,
    ItemContent,
    ItemDescription,
    ItemGroup,
    ItemMedia,
    ItemTitle,
} from "@/components/ui/item";
import { SettingsIcon, DownloadIcon, ChevronRightIcon, UsersIcon, MessageCircleIcon } from "lucide-react";
import Link from "next/link";
import { DashboardCard } from "./dashboard-card";


export function QuickActions({ projectId }: { projectId: string }) {
    const actions = [
        {
            title: "Ajouter un membre d'équipe",
            description: "Créer un nouveau membre d'équipe.",
            href: `/projects/${projectId}/team/new`,
            icon: (
                <UsersIcon aria-hidden="true" />
            ),
        },
        {
            title: "Voir les Conversations",
            description: "Aller aux conversations du projet.",
            href: `/projects/${projectId}/chats`,
            icon: (
                <MessageCircleIcon aria-hidden="true" />
            ),
        },
        {
            title: "Paramètres du projet",
            description: "Gérer les paramètres du projet.",
            href: `/projects/${projectId}/settings`,
            icon: (
                <SettingsIcon aria-hidden="true" />
            ),
        },
        {
            title: "Exporter les données",
            description: "Exporter les données du projet.",
            href: `/projects/${projectId}/analytics/contacts`,
            icon: (
                <DownloadIcon aria-hidden="true" />
            ),
        },
    ] as const;

    return (
        <DashboardCard className="col-span-1">
            <CardHeader>
                <CardTitle>Quick actions</CardTitle>
                <CardDescription>Shortcuts to same destinations.</CardDescription>
            </CardHeader>
            <CardContent>
                <ItemGroup className="gap-0">
                    {actions.map((a) => (
                        <Item asChild key={a.title} size="sm">
                            <Link href={a.href} title={a.title} className="flex items-center gap-2 p-3 hover:bg-accent/50 focus:bg-accent/50">
                                <ItemMedia variant="icon">{a.icon}</ItemMedia>
                                <ItemContent>
                                    <ItemTitle>{a.title}</ItemTitle>
                                    <ItemDescription className="line-clamp-1">
                                        {a.description}
                                    </ItemDescription>
                                </ItemContent>
                                <ItemActions>
                                    <ChevronRightIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                                </ItemActions>
                            </Link>
                        </Item>
                    ))}
                </ItemGroup>
            </CardContent>
        </DashboardCard>
    );
}
