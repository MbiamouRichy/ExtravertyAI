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
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Link
            href="/admin"
            className="flex shrink-0 items-center gap-2 rounded-md font-medium focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <ShieldCheck aria-hidden="true" className="size-4" />
            <span className="hidden sm:inline">Back-office</span>
            <span className="sr-only sm:hidden">Back-office</span>
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
