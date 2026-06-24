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
import type { SidebarNavGroup } from "@/components/app-shared";
import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

export function NavGroup({ label, items }: SidebarNavGroup) {
	const pathname = usePathname();
	return (
		<SidebarGroup>
			{label && <SidebarGroupLabel>{label}</SidebarGroupLabel>}
			<SidebarMenu>
				{items.map((item) => (
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
												<SidebarMenuButton isActive={item.path?.includes(pathname)}>
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
										<SidebarMenuButton asChild isActive={item.path?.includes(pathname)}>
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
