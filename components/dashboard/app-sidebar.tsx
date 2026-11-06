"use client";

import { useParams } from "next/navigation";
import { cn } from "@/lib/utils";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
} from "@/components/ui/sidebar";
import { navGroupsForRole } from "@/components/dashboard/app-shared";
import { NavGroup } from "@/components/dashboard/nav-group";
import { useIsProjectContext } from "./conditional-sidebar-trigger";
import { useProjectIdentity } from "./project-identity";
import { ProjectSwitcher } from "./project-switcher";
import { Skeleton } from "@/components/ui/skeleton";

export function AppSidebar() {
	const isProjectContext = useIsProjectContext();

	// Récupération des paramètres de l'URL
	const params = useParams();
	const projectId = params.projectId as string;

	// Navigation limitée aux pages que le rôle peut ouvrir
	const identity = useProjectIdentity(projectId);
	const navGroups = identity ? navGroupsForRole(projectId, identity.role) : [];

	if (isProjectContext && projectId) {
		return (
			<Sidebar
				className={cn(
					"**:data-[slot=sidebar-menu-button]:[&>span]:text-foreground/75"
				)}
				collapsible="icon"
				variant="inset"
			>
				{/* Le projet ouvert, qui sert aussi à passer d’un projet à l’autre. */}
				<SidebarHeader className="h-14 justify-center px-2">
					<ProjectSwitcher identity={identity} />
				</SidebarHeader>
				<SidebarContent>
					{/* Liens affichés une fois le rôle connu : jamais de lien vers une page fermée. */}
					{identity ? (
						navGroups.map((group, index) => (
							<NavGroup key={`sidebar-group-${index}`} {...group} />
						))
					) : (
						<div aria-hidden="true" className="flex flex-col gap-2 p-4">
							{Array.from({ length: 6 }, (_, index) => (
								<Skeleton key={index} className="h-6 w-full" />
							))}
						</div>
					)}
				</SidebarContent>
				<SidebarFooter className="gap-0 p-0">
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
