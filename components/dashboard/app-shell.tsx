import { cn } from "@/lib/utils";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppHeader } from "./app-header";
import { AppSidebar } from "./app-sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
	return (
		<SidebarProvider className={cn("[--app-wrapper-max-width:80rem]")}>
			<AppSidebar />
			<SidebarInset>
				<AppHeader />
				<div
					className={cn(
						"flex flex-1 flex-col",
						"mx-auto w-full max-w-(--app-wrapper-max-width)"
					)}
				>
					{children}
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
