"use client";
import type { ReactNode } from "react";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbList,
	BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { navLinks } from "./app-shared";
import { useActivePage } from "@/hooks/useActivePage";

/** Current page segment shown in the header — pass a nav item or `{ title, icon? }`. */
export type AppBreadcrumbPage = {
	title: string;
	icon?: ReactNode;
};

export function AppBreadcrumbs() {

	const { activeSection } = useActivePage()
	const page = navLinks.find((item) => item.title === activeSection)

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
