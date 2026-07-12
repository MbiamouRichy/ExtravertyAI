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
import { signOut } from "@/lib/auth-client";
import { User } from "better-auth";
import { UserIcon, SettingsIcon, CreditCardIcon, LogOutIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";


export function NavUser(user: User) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Avatar className="size-8">
					<AvatarImage src={user.image ?? undefined} />
					<AvatarFallback>{user.name.charAt(0).toUpperCase()}{user.name.charAt(1).toLowerCase()}</AvatarFallback>
				</Avatar>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-60">
				<DropdownMenuItem className="flex items-center justify-start gap-2">
					<DropdownMenuLabel className="flex items-center gap-3">
						<Avatar className="size-10">
							<AvatarImage src={user.image ?? undefined} />
							<AvatarFallback>{user.name.charAt(0).toUpperCase()}{user.name.charAt(1).toLowerCase()}</AvatarFallback>
						</Avatar>
						<div>
							<span className="font-medium text-foreground">{user.name}</span>{" "}
							<br />
							<div className="max-w-full overflow-hidden overflow-ellipsis whitespace-nowrap text-muted-foreground text-xs">
								{user.email}
							</div>
						</div>
					</DropdownMenuLabel>
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuGroup>
					<DropdownMenuItem>
						<UserIcon
						/>
						<Link href="/dashboard/user" className="w-full">
							Profil
						</Link>
					</DropdownMenuItem>
					<DropdownMenuItem>
						<SettingsIcon
						/>
						Settings
					</DropdownMenuItem>
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
				<DropdownMenuGroup>
					<DropdownMenuItem>
						<CreditCardIcon
						/>
						Plan & Billing
					</DropdownMenuItem>
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
				<DropdownMenuGroup>
					<DropdownMenuItem
						onClick={() => {
							signOut()
							redirect("/sign-in");
						}}
						className="w-full cursor-pointer"
						variant="destructive"
					>
						<LogOutIcon
						/>
						Se déconnecter
					</DropdownMenuItem>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
