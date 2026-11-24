"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Coins, LayoutDashboard, LifeBuoy, MessageSquareHeart, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/admin", label: "Vue d’ensemble", icon: LayoutDashboard, exact: true },
  { href: "/admin/paiements", label: "Paiements", icon: Wallet, exact: false },
  { href: "/admin/feedback", label: "Retours", icon: MessageSquareHeart, exact: false },
  { href: "/admin/aide", label: "Aide", icon: LifeBuoy, exact: false },
  { href: "/admin/ai-costs", label: "Coûts IA", icon: Coins, exact: false },
] as const;

export function AdminNav() {
  const pathname = usePathname();
  return (
    // Sous lg : ligne pleine largeur sous le logo. Sous sm, icônes seules
    // réparties sur toute la ligne (cibles de 40 px) ; au-dessus, avec libellés.
    // Le défilement horizontal n'est qu'un filet si un libellé s'allonge.
    <nav
      aria-label="Back-office"
      className="order-last -mx-1 flex min-w-0 basis-full items-center gap-1 overflow-x-auto px-1 pt-0.5 pb-1.5 [scrollbar-width:none] lg:order-none lg:mx-0 lg:ml-2 lg:basis-auto lg:overflow-visible lg:p-0 [&::-webkit-scrollbar]:hidden"
    >
      {LINKS.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Button
            key={href}
            asChild
            variant="ghost"
            size="sm"
            className={cn("h-10 flex-1 sm:h-8 sm:flex-none", active && "bg-muted text-foreground")}
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
