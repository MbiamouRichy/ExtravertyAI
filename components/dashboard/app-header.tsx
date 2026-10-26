import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { AppBreadcrumbs } from "@/components/dashboard/app-breadcrumbs";
import { NavUser } from "@/components/dashboard/nav-user";
import { Notifications } from "./notifications";
import { FeedbackDialog } from "./feedback-dialog";
import { ConditionalSidebarTrigger } from "./conditional-sidebar-trigger";

export async function AppHeader() {
  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 flex h-14 shrink-0 items-center justify-between gap-2 border-b px-4 md:sticky md:inset-x-auto md:rounded-t-xl md:px-6",
        "bg-background/95 backdrop-blur-sm supports-backdrop-filter:bg-background/50",
      )}
    >
      <div className="flex items-center gap-3">
        <ConditionalSidebarTrigger />
        <Separator
          className="mr-2 h-4 data-[orientation=vertical]:self-center transition-all duration-200"
          orientation="vertical"
        />
        <AppBreadcrumbs />
      </div>
      <div className="flex items-center gap-3">
        {/* « Nouveau projet » reste sur la page Projets ; ici, le retour produit. */}
        <FeedbackDialog />
        <Notifications />
        <Separator
          className="h-4 data-[orientation=vertical]:self-center"
          orientation="vertical"
        />
        <NavUser />
      </div>
    </header>
  );
}
