import Link from "next/link";
import {
  BarChart3,
  ChevronRight,
  Download,
  MessagesSquare,
  Settings,
  Users,
} from "lucide-react";

export function QuickActions({ projectId }: { projectId: string }) {
  const base = `/projects/${encodeURIComponent(projectId)}`;
  const actions = [
    { title: "Messagerie", description: "Répondre à vos clients", href: `${base}/chat`, icon: MessagesSquare },
    { title: "Statistiques", description: "Analyser l’activité", href: `${base}/analytics`, icon: BarChart3 },
    { title: "Équipe", description: "Inviter et gérer les rôles", href: `${base}/team`, icon: Users },
    { title: "Contacts", description: "Consulter et exporter", href: `${base}/contacts`, icon: Download },
    { title: "Paramètres", description: "Agent IA et WhatsApp", href: `${base}/settings`, icon: Settings },
  ];

  return (
    <nav aria-label="Actions rapides">
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
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
                className="hidden size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 sm:block"
              />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
