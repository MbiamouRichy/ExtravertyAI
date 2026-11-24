import Link from "next/link";
import { ArrowUpRight, ShieldCheck } from "lucide-react";

import { requireAdminPage } from "@/lib/admin-auth";
import { Button } from "@/components/ui/button";
import { AdminNav } from "@/components/admin/admin-nav";

/**
 * Back-office interne. Chaque page et chaque action revérifie l'accès : ce
 * layout ne se réexécute pas à chaque navigation côté client.
 */
export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const admin = await requireAdminPage();
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
        {/* Sous 1024 px, la navigation passe sur une seconde ligne (AdminNav) :
            logo, cinq liens et bouton Application ne tiennent pas sur une seule. */}
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-3 px-4 sm:px-6 lg:flex-nowrap lg:px-8">
          <Link
            href="/admin"
            className="flex h-12 shrink-0 items-center gap-2 rounded-md font-medium lg:h-14 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <ShieldCheck aria-hidden="true" className="size-4" />
            Back-office
          </Link>
          <AdminNav />
          <div className="ml-auto flex min-w-0 items-center gap-2">
            <span
              className="hidden truncate text-xs text-muted-foreground md:inline"
              title={admin.email}
            >
              {admin.email}
            </span>
            <Button asChild variant="outline" size="sm">
              <Link href="/projects">
                <span className="hidden sm:inline">Application</span>
                <span className="sr-only sm:hidden">Retour à l’application</span>
                <ArrowUpRight data-icon="inline-end" />
              </Link>
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}
