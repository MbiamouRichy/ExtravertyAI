"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { cn } from "@/lib/utils";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarMenuButton,
} from "@/components/ui/sidebar";
import { getNavGroups } from "@/components/dashboard/app-shared";
import { NavGroup } from "@/components/dashboard/nav-group";
import { useIsProjectContext } from "./conditional-sidebar-trigger";
import { useProjectIdentity } from "./project-identity";
import { ProjectIcon } from "./project/project-icon";
import { Skeleton } from "@/components/ui/skeleton";

export function AppSidebar() {
	const isProjectContext = useIsProjectContext();

	// Récupération des paramètres de l'URL
	const params = useParams();
	const projectId = params.projectId as string;

	// Génération de la navigation dynamique
	const navGroups = projectId ? getNavGroups(projectId) : [];
	const identity = useProjectIdentity(projectId);

	if (isProjectContext && projectId) {
		return (
			<Sidebar
				className={cn(
					"**:data-[slot=sidebar-menu-button]:[&>span]:text-foreground/75"
				)}
				collapsible="icon"
				variant="inset"
			>
				{/* Le projet ouvert (icône et nom) plutôt que la marque de l’application. */}
				<SidebarHeader className="h-14 justify-center px-2">
					<SidebarMenuButton asChild size="lg" tooltip={identity?.name}>
						<Link href={`/projects/${encodeURIComponent(projectId)}`}>
							{identity ? (
								<ProjectIcon
									name={identity.name}
									logoUrl={identity.logoUrl}
									className="size-8 rounded-lg after:rounded-lg"
									fallbackClassName="rounded-lg text-xs"
								/>
							) : (
								<Skeleton className="size-8 shrink-0 rounded-lg" />
							)}
							{identity ? (
								<span className="truncate font-heading text-sm font-semibold">
									{identity.name}
								</span>
							) : (
								<Skeleton className="h-4 w-28" />
							)}
						</Link>
					</SidebarMenuButton>
				</SidebarHeader>
				<SidebarContent>
					{/* Utilisation des navGroups dynamiques */}
					{navGroups.map((group, index) => (
						<NavGroup key={`sidebar-group-${index}`} {...group} />
					))}
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
