// Composant partagé (sans « use client ») : utilisable depuis un Server
// Component, qui peut lui passer une icône Lucide sans franchir de frontière client.
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/** Two-column settings row: title and description on the left, content on the right. */
export function SettingsSection({
  icon: Icon,
  title,
  description,
  aside,
  danger = false,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  aside?: ReactNode;
  danger?: boolean;
  children: ReactNode;
}) {
  const id = `section-${title.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <section aria-labelledby={id} className="grid gap-4 border-t pt-8 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] md:gap-10">
      <div>
        <h2 id={id} className={cn("flex items-center gap-2 font-heading text-base font-semibold tracking-tight", danger && "text-destructive")}>
          <Icon aria-hidden="true" className="size-4" />
          {title}
          {aside}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}
