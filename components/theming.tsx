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

export function ModeToggle({ screen }: { screen: "mobile" | "desktop" }) {
  const { theme, setTheme } = useTheme();

  return screen === "desktop" ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
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
        <Button
          aria-label="Activer le thème clair"
          aria-pressed={theme === "light"}
          variant={theme === "light" ? "default" : "outline"}
          size="icon"
          onClick={() => setTheme("light")}
        >
          <Sun />
        </Button>
        <Button
          aria-label="Activer le thème sombre"
          aria-pressed={theme === "dark"}
          variant={theme === "dark" ? "default" : "outline"}
          size="icon"
          onClick={() => setTheme("dark")}
        >
          <Moon />
        </Button>
        <Button
          aria-label="Utiliser le thème du système"
          aria-pressed={theme === "system"}
          variant={theme === "system" ? "default" : "outline"}
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
