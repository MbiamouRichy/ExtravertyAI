import Link from "next/link";
import { canOpenPage, type ProjectPage } from "@/lib/project-permissions";
import {
  BarChart3,
  Bot,
  ChevronRight,
  Download,
  MessagesSquare,
  Settings,
  Users,
} from "lucide-react";

export function QuickActions({ projectId, role }: { projectId: string; role: string }) {
  const base = `/projects/${encodeURIComponent(projectId)}`;
  const actions = ([
    { title: "Messagerie", description: "Répondre à vos clients", page: "chat", icon: MessagesSquare },
    { title: "Statistiques", description: "Analyser l’activité", page: "analytics", icon: BarChart3 },
    { title: "Équipe", description: "Inviter et gérer les rôles", page: "team", icon: Users },
    { title: "Contacts", description: "Consulter et exporter", page: "contacts", icon: Download },
    { title: "Assistant IA", description: "Consignes et connaissances", page: "knowledge", icon: Bot },
    { title: "Paramètres", description: "WhatsApp et projet", page: "settings", icon: Settings },
  ] satisfies Array<{
    title: string;
    description: string;
    page: ProjectPage;
    icon: typeof Users;
  }>).flatMap(({ page, ...action }) =>
    canOpenPage(role, page) ? [{ ...action, href: `${base}/${page}` }] : [],
  );

  return (
    <nav aria-labelledby="actions-title">
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {actions.map(({ title, description, href, icon: Icon }) => (
          <li key={title}>
            <Link
              href={href}
              className="group flex h-full items-center gap-3 rounded-xl border bg-card p-3 outline-none transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-background">
                <Icon aria-hidden="true" className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{title}</span>
                <span className="block truncate text-xs text-muted-foreground">{description}</span>
              </span>
              <ChevronRight
                aria-hidden="true"
                className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
              />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
