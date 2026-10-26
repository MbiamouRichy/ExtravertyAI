"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { UserIcon, Palette, UserCog, Loader2Icon } from "lucide-react";
import Link from "next/link";
import { ModifierProfile } from "./user/modifierProfile";
import React from "react";
import { useTheme } from "next-themes";
import { updateThemeAction } from "@/app/actions/user";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import SignOutButton from "./user/signOutButton";
import { useSession } from "@/lib/auth-client";
import { redirect } from "next/navigation";
import { getInitials } from "../getInitials";

export function NavUser() {
  const { theme, setTheme } = useTheme();
  const [savingTheme, startThemeTransition] = React.useTransition();
  const changeTheme = (value: string) => {
    if (savingTheme || !["light", "dark", "system"].includes(value)) return;
    const previous = theme || "system";
    setTheme(value);
    startThemeTransition(async () => {
      try {
        const result = await updateThemeAction({
          theme: value as "light" | "dark" | "system",
        });
        if (!result.success) throw new Error();
      } catch {
        setTheme(previous);
        toast.error("Le thème n’a pas pu être enregistré.");
      }
    });
  };
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const { data: session, isPending } = useSession();
  if (isPending) {
    return (
      <Loader2Icon className="w-6 h-6 animate-spin text-muted-foreground" />
    );
  }
  if (!session || !session.user.id) {
    return redirect("/sign-in");
  }
  const user = session.user;
  return (
    <>
      <ModifierProfile
        open={isModalOpen}
        setOpen={setIsModalOpen}
        user={user}
      />
      <DropdownMenu>
        <DropdownMenuTrigger className="cursor-pointer" asChild>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            aria-label="Menu du compte"
          >
            <Avatar className="size-8">
              <AvatarImage src={user.image ?? undefined} />
              <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuItem
            className="flex items-center justify-start gap-2 cursor-pointer"
            asChild
          >
            <Link href="/projects/user" className="w-full">
              <DropdownMenuLabel className="flex items-center gap-3">
                <Avatar className="size-10">
                  <AvatarImage src={user.image ?? undefined} />
                  <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                </Avatar>
                <div>
                  <span className="font-medium text-foreground">
                    {user.name}
                  </span>{" "}
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
              <Link href="/projects/user" className="w-full">
                <UserIcon />
                Compte
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer"
              onSelect={() => setIsModalOpen(true)}
            >
              <UserCog />
              Modifier le profil
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Palette aria-hidden />
                Thème
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuRadioGroup
                  value={theme || "system"}
                  onValueChange={changeTheme}
                >
                  <DropdownMenuRadioItem disabled={savingTheme} value="light">
                    Clair
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem disabled={savingTheme} value="dark">
                    Sombre
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem disabled={savingTheme} value="system">
                    Système
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem className="cursor-pointer" asChild>
              <SignOutButton
                variant="destructive"
                className="w-full justify-start bg-background focus:bg-destructive/10 dark:focus:bg-destructive/20"
              />
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
