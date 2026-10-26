"use client"
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	SidebarGroup,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import type { SidebarNavGroup } from "@/components/dashboard/app-shared";
import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { useActivePage } from "@/hooks/useActivePage";

export function NavGroup({ label, items }: SidebarNavGroup) {
	const { pathname, activeSection } = useActivePage();
	return (
		<SidebarGroup>
			{label && <SidebarGroupLabel>{label}</SidebarGroupLabel>}
			<SidebarMenu>
				{items.map((item) => item.show !== false && (
					<Collapsible
						asChild
						className="group/collapsible"
						key={item.title}
					>
						<Tooltip delayDuration={1000}>
							<TooltipTrigger asChild>
								<SidebarMenuItem>
									{item.subItems?.length ? (
										<>
											<CollapsibleTrigger asChild>
												<SidebarMenuButton isActive={item.title === activeSection}>
													{item.icon}
													<span>{item.title}</span>
													<ChevronRightIcon className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
												</SidebarMenuButton>
											</CollapsibleTrigger>
											<CollapsibleContent>
												<SidebarMenuSub>
													{item.subItems?.map((subItem) => (

														<SidebarMenuSubItem key={subItem.title}>
															<SidebarMenuSubButton
																asChild
																isActive={subItem.path === pathname}
															>
																<Link href={subItem.path || "#"}>
																	{subItem.icon}
																	<span>{subItem.title}</span>
																</Link>
															</SidebarMenuSubButton>
														</SidebarMenuSubItem>

													))}
												</SidebarMenuSub>
											</CollapsibleContent>
										</>
									) : (
										<SidebarMenuButton asChild isActive={item.title === activeSection}>
											<Link href={item.path || "#"}>
												{item.icon}
												<span>{item.title}</span>
											</Link>
										</SidebarMenuButton>
									)}
								</SidebarMenuItem>
							</TooltipTrigger>
							<TooltipContent side="right">
								{item.title} {" "}
							</TooltipContent>
						</Tooltip>
					</Collapsible>
				))}
			</SidebarMenu>
		</SidebarGroup>
	);
}
