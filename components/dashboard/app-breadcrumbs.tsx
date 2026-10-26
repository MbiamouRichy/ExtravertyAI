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
		<Breadcrumb>
			<BreadcrumbList>
				<BreadcrumbItem>
					<BreadcrumbPage className="flex items-center truncate gap-2 [&>svg]:size-3.5">
						{page.icon}
						{page.title}
					</BreadcrumbPage>
				</BreadcrumbItem>
			</BreadcrumbList>
		</Breadcrumb>
	);
}
