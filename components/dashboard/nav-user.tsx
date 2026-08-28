"use client";

import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@/components/ui/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserIcon, SettingsIcon, CreditCardIcon, UserCog, Loader2Icon } from "lucide-react";
import Link from "next/link";
import { ModifierProfile } from "./user/modifierProfile";
import React from "react";
import SignOutButton from "./user/signOutButton";
import { useSession } from "@/lib/auth-client";
import { redirect } from "next/navigation";
import { getInitials } from "../getInitials";


export function NavUser() {
	const [isModalOpen, setIsModalOpen] = React.useState(false);
	const { data: session, isPending } = useSession();
	if (isPending) {
		return <Loader2Icon className="w-6 h-6 animate-spin text-neutral-500" />;
	}
	if (!session || !session.user.id) {
		redirect("/sign-in")
	}
	const user = session.user
	return (
		<>
			<ModifierProfile open={isModalOpen} setOpen={setIsModalOpen} user={user} />
			<DropdownMenu>
				<DropdownMenuTrigger className="cursor-pointer" asChild>
					<Avatar className="size-8 ">
						<AvatarImage src={user.image ?? undefined} />
						<AvatarFallback>{getInitials(user.name)}</AvatarFallback>
					</Avatar>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-60">
					<DropdownMenuItem className="flex items-center justify-start gap-2 cursor-pointer" asChild>
						<Link href="/dashboard/user" className="w-full">
							<DropdownMenuLabel className="flex items-center gap-3">
								<Avatar className="size-10">
									<AvatarImage src={user.image ?? undefined} />
									<AvatarFallback>
										{getInitials(user.name)}
									</AvatarFallback>
								</Avatar>
								<div>
									<span className="font-medium text-foreground">{user.name}</span>{" "}
									<br />
									<div className="max-w-full overflow-hidden overflow-ellipsis whitespace-nowrap text-muted-foreground text-xs">
										{user.email}
									</div>
								</div>
							</DropdownMenuLabel>
						</Link>
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					<DropdownMenuGroup>
						<DropdownMenuItem className="cursor-pointer" asChild>
							<Link href="/dashboard/user" className="w-full">
								<UserIcon
								/>
								Infos générales
							</Link>
						</DropdownMenuItem>
						<DropdownMenuItem className="cursor-pointer" onSelect={() => setIsModalOpen(true)}>
							<UserCog />
							Modifier le profil
						</DropdownMenuItem>
						<DropdownMenuItem asChild className="cursor-pointer">
							<Link href="/dashboard/user/settings" title="Parametres utilisateur">
								<SettingsIcon
								/>
								Paramètres</Link>
						</DropdownMenuItem>
					</DropdownMenuGroup>
					<DropdownMenuSeparator />
					<DropdownMenuGroup>
						<DropdownMenuItem className="cursor-pointer" asChild>
							<Link href="/dashboard/billing" className="w-full">
								<CreditCardIcon
								/>
								Plan & Tarifs
							</Link>
						</DropdownMenuItem>
					</DropdownMenuGroup>
					<DropdownMenuSeparator />
					<DropdownMenuGroup>
						<DropdownMenuItem className="cursor-pointer" asChild>
							<SignOutButton variant="destructive" className="w-full justify-start bg-background focus:bg-destructive/10 dark:focus:bg-destructive/20" />
						</DropdownMenuItem>
					</DropdownMenuGroup>
				</DropdownMenuContent>
			</DropdownMenu>
		</>

	);
}
