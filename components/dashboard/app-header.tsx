import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { DecorIcon } from "@/components/decor-icon";
import { AppBreadcrumbs } from "@/components/dashboard/app-breadcrumbs";
import { CustomSidebarTrigger } from "@/components/dashboard/custom-sidebar-trigger";
import { NavUser } from "@/components/dashboard/nav-user";
import { BellIcon, Plus } from "lucide-react";
import { Notifications } from "./notifications";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import Link from "next/link";




export async function AppHeader() {

	return (
		<header
			className={cn(
				"sticky top-0 z-50 flex h-14 shrink-0 items-center justify-between gap-2 border-b px-4 md:px-6",
				"bg-background/95 backdrop-blur-sm supports-backdrop-filter:bg-background/50"
			)}
		>
			<DecorIcon className="hidden md:block" position="bottom-left" />
			<div className="flex items-center gap-3">
				<CustomSidebarTrigger />
				<Separator
					className="mr-2 h-4 data-[orientation=vertical]:self-center"
					orientation="vertical"
				/>
				<AppBreadcrumbs />
			</div>
			<div className="flex items-center gap-3">
				<Tooltip>
					<TooltipTrigger className="cursor-pointer">
						<Button asChild size="icon-sm">
							<Link href="/dashboard/projects" title="Projets">
								<Plus className="h-4 w-4" />
							</Link>
						</Button>
					</TooltipTrigger>
					<TooltipContent>
						<p className="text-sm leading-relaxed">Nouveau project</p>
					</TooltipContent>
				</Tooltip>
				<Notifications>
					<Button aria-label="Notifications" size="icon-sm" variant="outline">
						<BellIcon
						/>
					</Button>
				</Notifications>
				<Separator
					className="h-4 data-[orientation=vertical]:self-center"
					orientation="vertical"
				/>
				<NavUser />
			</div>
		</header>
	);
}
