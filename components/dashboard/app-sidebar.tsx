"use client";

import { useParams } from "next/navigation"; // Ajout de useParams
import { cn } from "@/lib/utils";
import { LogoIcon } from "@/components/logo";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar";
import { footerNavLinks, getNavGroups } from "@/components/dashboard/app-shared"; // Import de la fonction
import { LatestChange } from "@/components/dashboard/latest-change";
import { NavGroup } from "@/components/dashboard/nav-group";
import Link from "next/link";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { useIsProjectContext } from "./conditional-sidebar-trigger";

export function AppSidebar() {
	const isProjectContext = useIsProjectContext();

	// Récupération des paramètres de l'URL
	const params = useParams();
	const projectId = params.projectId as string;

	// Génération de la navigation dynamique
	const navGroups = projectId ? getNavGroups(projectId) : [];

	if (isProjectContext && projectId) {
		return (
			<Sidebar
				className={cn(
					"*:data-[slot=sidebar-inner]:bg-background",
					"*:data-[slot=sidebar-inner]:dark:bg-[radial-gradient(60%_18%_at_10%_0%,--theme(--color-foreground/.08),transparent)]",
					"**:data-[slot=sidebar-menu-button]:[&>span]:text-foreground/75"
				)}
				collapsible="icon"
				variant="sidebar"
			>
				<SidebarHeader className="h-14 justify-center border-b px-2">
					<SidebarMenuButton asChild>
						<LogoIcon LogoClassName="w-6" />
					</SidebarMenuButton>
				</SidebarHeader>
				<SidebarContent>
					{/* Utilisation des navGroups dynamiques */}
					{navGroups.map((group, index) => (
						<NavGroup key={`sidebar-group-${index}`} {...group} />
					))}
				</SidebarContent>
				<SidebarFooter className="gap-0 p-0">
					<LatestChange />
					<SidebarMenu className="border-t p-2">
						{footerNavLinks.map((item) => (
							<Tooltip delayDuration={1000} key={item.title}>
								<TooltipTrigger asChild>
									<SidebarMenuItem key={item.title}>
										<SidebarMenuButton
											asChild
											className="text-muted-foreground"
											isActive={item.isActive}
											size="sm"
										>
											<Link href={item.path || "#"}>
												{item.icon}
												<span>{item.title}</span>
											</Link>
										</SidebarMenuButton>
									</SidebarMenuItem>
								</TooltipTrigger>
								<TooltipContent side="right">
									{item.title}
								</TooltipContent>
							</Tooltip>
						))}
					</SidebarMenu>
					<div className="px-4 pt-4 pb-2 transition-opacity group-data-[collapsible=icon]:pointer-events-none group-data-[collapsible=icon]:opacity-0">
						<p className="text-nowrap text-[9px] text-muted-foreground">
							© {new Date().getFullYear()} ExtravertyAI.
						</p>
					</div>
				</SidebarFooter>
			</Sidebar>
		)
	} else return null
}