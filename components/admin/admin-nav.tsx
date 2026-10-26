"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, MessageSquareHeart } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/admin", label: "Vue d’ensemble", icon: LayoutDashboard, exact: true },
  { href: "/admin/feedback", label: "Retours", icon: MessageSquareHeart, exact: false },
] as const;

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Back-office" className="ml-2 flex min-w-0 items-center gap-1">
      {LINKS.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Button
            key={href}
            asChild
            variant="ghost"
            size="sm"
            className={cn(active && "bg-muted text-foreground")}
          >
            <Link href={href} aria-current={active ? "page" : undefined}>
              <Icon data-icon="inline-start" />
              <span className="hidden sm:inline">{label}</span>
              <span className="sr-only sm:hidden">{label}</span>
            </Link>
          </Button>
        );
      })}
    </nav>
  );
}
