"use client";
import type { ReactNode } from "react";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbList,
	BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { useActivePage } from "@/hooks/useActivePage";
import { useParams } from "next/navigation";
import { navLinks } from "./app-shared";

/** Current page segment shown in the header — pass a nav item or `{ title, icon? }`. */
export type AppBreadcrumbPage = {
	title: string;
	icon?: ReactNode;
};

export function AppBreadcrumbs() {

	const { activeSection } = useActivePage()
	const params = useParams();
	const projectId = params.projectId as string;
	const page = navLinks(projectId).find((item: AppBreadcrumbPage) => item.title === activeSection)

	if (!page) {
		return null
	}

	return (
		// Très petit écran (moins de 360 px) : masqué. L’icône seule n’y disait
		// rien, et la place revient aux boutons de l’en-tête.
		<Breadcrumb className="min-w-0 max-[359px]:hidden">
			<BreadcrumbList className="flex-nowrap">
				<BreadcrumbItem className="min-w-0">
					<BreadcrumbPage className="flex min-w-0 items-center gap-2 [&>svg]:size-3.5 [&>svg]:shrink-0">
						{page.icon}
						<span className="truncate">{page.title}</span>
					</BreadcrumbPage>
				</BreadcrumbItem>
			</BreadcrumbList>
		</Breadcrumb>
	);
}
