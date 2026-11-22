import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { AppBreadcrumbs } from "@/components/dashboard/app-breadcrumbs";
import { NavUser } from "@/components/dashboard/nav-user";
import { Notifications } from "./notifications";
import { FeedbackDialog } from "./feedback-dialog";
import { HelpButton } from "./help-button";
import { ConditionalSidebarTrigger } from "./conditional-sidebar-trigger";

export async function AppHeader() {
  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 flex h-14 shrink-0 items-center justify-between gap-2 border-b px-4 md:sticky md:inset-x-auto md:rounded-t-xl md:px-6",
        "bg-background/95 backdrop-blur-sm supports-backdrop-filter:bg-background/50",
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-3">
        <ConditionalSidebarTrigger />
        {/* Mobile : pas de séparateurs, la place va aux boutons. */}
        <Separator
          className="mr-2 h-4 transition-all duration-200 max-sm:hidden data-[orientation=vertical]:self-center"
          orientation="vertical"
        />
        <AppBreadcrumbs />
      </div>
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
        {/* « Nouveau projet » reste sur la page Projets ; ici, l’aide de la page et le retour produit. */}
        <HelpButton />
        <FeedbackDialog />
        <Notifications />
        <Separator
          className="h-4 max-sm:hidden data-[orientation=vertical]:self-center"
          orientation="vertical"
        />
        <NavUser />
      </div>
    </header>
  );
}
