"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ModeToggle({screen}: {screen: "mobile" | "desktop"}) {
  const { setTheme } = useTheme();

  return screen === "desktop" ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className="hover:bg-muted dark:hover:bg-muted/50 border border-border"
          variant="ghost"
          size="icon"
        >
          <Sun className="scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
          <Moon className="absolute scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
          <span className="sr-only">Changer de mode</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          Lumineux
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          Sombre
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          Système
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ) : (
    <div className="flex flex-row items-center gap-2">
      <p>Mode :</p>
      <div className="flex flex-row gap-1">
        <Button variant="outline" size="icon" onClick={() => setTheme("light")}>
          <Sun />
        </Button>
        <Button variant="outline" size="icon" onClick={() => setTheme("dark")}>
          <Moon />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setTheme("system")}
        >
          <Sun />
          <Moon className="absolute" />
        </Button>
      </div>
    </div>
  );

}
