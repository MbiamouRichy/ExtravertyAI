"use client";

import React, { useTransition } from "react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { updateThemeAction } from "@/app/actions/user"; // Ajuste le chemin

import { AlertTriangle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useHaptics } from "@/lib/webHaptics";
import type { AccountDeletionPlan } from "@/lib/account-deletion";
import { DeleteAccountDialog } from "./delete-account-dialog";
export default function UserSettingsPage({
  sessionCreatedAt,
  email,
  deletionPlan,
}: {
  sessionCreatedAt: string;
  email: string;
  deletionPlan: AccountDeletionPlan;
}) {
  const { playHaptic } = useHaptics();

  // Pour le thème
  const { theme, setTheme } = useTheme();
  const [isPendingTheme, startThemeTransition] = useTransition();

  // --- GESTION DU THÈME ---
  const handleThemeChange = (newTheme: "light" | "dark" | "system") => {
    if (isPendingTheme || newTheme === theme) return;
    const previousTheme = theme ?? "system";
    setTheme(newTheme); // 1. Mise à jour UI instantanée (optimiste)
    // 2. Enregistrement en base de données en arrière-plan
    startThemeTransition(async () => {
      try {
        const result = await updateThemeAction({ theme: newTheme });
        if (!result.success) throw new Error("THEME_SAVE_FAILED");
        playHaptic("success");
      } catch {
        setTheme(previousTheme);
        playHaptic("error");
        toast.error("Erreur lors de la sauvegarde du thème");
      }
    });
  };

  return (
    <>
      {/* --- SECTION APPARENCE --- */}
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Thème de l&apos;application</CardTitle>
                <CardDescription>
                  Personnalisez l&apos;interface selon vos préférences.
                </CardDescription>
              </div>
              {/* Petit loader discret si ça sauvegarde en base */}
              {isPendingTheme && (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Thème Clair */}
              <Button
                variant={theme === "light" ? "outline" : "ghost"}
                disabled={isPendingTheme}
                aria-pressed={theme === "light"}
                className="h-fit flex-col p-3"
                onClick={() => handleThemeChange("light")}
              >
                <div className="w-full h-24 bg-neutral-100 rounded-md border shadow-xs flex items-center justify-center mb-2">
                  <div className="w-1/2 h-1/2 bg-white rounded shadow-xs"></div>
                </div>
                <span className="font-medium text-sm">Clair</span>
              </Button>

              {/* Thème Sombre */}
              <Button
                variant={theme === "dark" ? "outline" : "ghost"}
                disabled={isPendingTheme}
                aria-pressed={theme === "dark"}
                className="h-fit flex-col p-3"
                onClick={() => handleThemeChange("dark")}
              >
                <div className="w-full h-24 bg-neutral-900 rounded-md border border-neutral-800 shadow-xs flex items-center justify-center mb-2">
                  <div className="w-1/2 h-1/2 bg-neutral-800 rounded shadow-xs"></div>
                </div>
                <span className="font-medium text-sm">Sombre</span>
              </Button>

              {/* Thème Système */}
              <Button
                variant={theme === "system" ? "outline" : "ghost"}
                disabled={isPendingTheme}
                aria-pressed={theme === "system"}
                className="h-fit flex-col p-3"
                onClick={() => handleThemeChange("system")}
              >
                <div className="w-full h-24 bg-linear-to-r from-neutral-100 to-neutral-900 rounded-md border shadow-xs flex items-center justify-center mb-2">
                  <div className="w-1/2 h-1/2 bg-neutral-500 rounded shadow-xs"></div>
                </div>
                <span className="font-medium text-sm">Système</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* --- SECTION SÉCURITÉ & COMPTE --- */}
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <Card className="border-destructive/20 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Zone de danger
            </CardTitle>
            <CardDescription>
              Les actions ci-dessous sont irréversibles.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 border border-destructive/20 rounded-lg bg-background">
              <div>
                <h4 className="font-medium">Supprimer le compte</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Supprime votre profil et les projets dont vous êtes l’unique membre. Les projets partagés doivent d’abord être transférés.
                </p>
              </div>

              <DeleteAccountDialog
                email={email}
                plan={deletionPlan}
                sessionCreatedAt={sessionCreatedAt}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
