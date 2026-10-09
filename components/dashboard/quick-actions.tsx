import {
  Card,
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
import {
  SettingsIcon,
  DownloadIcon,
  ChevronRightIcon,
  UsersIcon,
  MessageCircleIcon,
} from "lucide-react";
import Link from "next/link";

export function QuickActions({ projectId }: { projectId: string }) {
  const actions = [
    {
      title: "Gérer l'équipe",
      description: "Gérer les membres de l'équipe.",
      href: `/projects/${projectId}/team`,
      icon: <UsersIcon aria-hidden="true" />,
    },
    {
      title: "Voir les Conversations",
      description: "Aller aux conversations du projet.",
      href: `/projects/${projectId}/chat`,
      icon: <MessageCircleIcon aria-hidden="true" />,
    },
    {
      title: "Paramètres du projet",
      description: "Gérer les paramètres du projet.",
      href: `/projects/${projectId}/settings`,
      icon: <SettingsIcon aria-hidden="true" />,
    },
    {
      title: "Exporter les données",
      description: "Exporter les données du projet.",
      href: `/projects/${projectId}/contacts`,
      icon: <DownloadIcon aria-hidden="true" />,
    },
  ] as const;

  return (
    <Card className="w-full min-w-0">
      <CardHeader className="border-b">
        <CardTitle>Actions rapides</CardTitle>
        <CardDescription>Accédez aux outils de votre projet.</CardDescription>
      </CardHeader>
      <CardContent>
        <ItemGroup className="grid grid-cols-1 gap-2 sm:grid-cols-2 2xl:grid-cols-4">
          {actions.map((a) => (
            <Item asChild key={a.title} size="sm">
              <Link
                href={a.href}
                title={a.title}
                className="flex items-center gap-2 p-3 hover:bg-accent/50 focus:bg-accent/50"
              >
                <ItemMedia variant="icon">{a.icon}</ItemMedia>
                <ItemContent>
                  <ItemTitle>{a.title}</ItemTitle>
                  <ItemDescription className="line-clamp-1">
                    {a.description}
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <ChevronRightIcon
                    aria-hidden="true"
                    className="size-4 shrink-0 text-muted-foreground"
                  />
                </ItemActions>
              </Link>
            </Item>
          ))}
        </ItemGroup>
      </CardContent>
    </Card>
  );
}
