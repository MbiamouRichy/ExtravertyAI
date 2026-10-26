import { cn } from "@/lib/utils";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppHeader } from "./app-header";
import { AppSidebar } from "./app-sidebar";
import { TimeZoneSync } from "@/components/local-date";
import { ProjectIdentityProvider } from "./project-identity";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ProjectIdentityProvider>
      <SidebarProvider className={cn("[--app-wrapper-max-width:90rem]")}>
        <TimeZoneSync />
        <AppSidebar />
        <SidebarInset className="min-w-0 pt-14 md:pt-0 md:peer-data-[variant=inset]:ml-0">
          <AppHeader />
          <div
            className={cn(
              "mx-auto flex w-full min-w-0 flex-1 flex-col rounded-b-xl overflow-clip",
              "max-w-(--app-wrapper-max-width)",
            )}
          >
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </ProjectIdentityProvider>
  );
}
