"use client";

import React, { useTransition } from "react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { updateThemeAction } from "@/app/actions/user"; // Ajuste le chemin

import { AlertTriangle, Check, Loader2, Palette, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
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

  const themes = [
    { id: "light" as const, label: "Clair", preview: "bg-neutral-100", inner: "bg-white" },
    { id: "dark" as const, label: "Sombre", preview: "bg-neutral-900", inner: "bg-neutral-700" },
    { id: "system" as const, label: "Système", preview: "bg-linear-to-r from-neutral-100 to-neutral-900", inner: "bg-neutral-500" },
  ];

  return (
    <>
      <SettingsSection
        icon={Palette}
        title="Apparence"
        description="Le thème est enregistré sur votre compte et suit vos appareils."
        aside={
          isPendingTheme ? (
            <Loader2 aria-label="Enregistrement" className="size-4 animate-spin text-muted-foreground" />
          ) : null
        }
      >
        <div role="group" aria-label="Thème de l’application" className="grid grid-cols-3 gap-3">
          {themes.map((item) => {
            const selected = theme === item.id;
            return (
              <Button
                key={item.id}
                variant="ghost"
                disabled={isPendingTheme}
                aria-pressed={selected}
                onClick={() => handleThemeChange(item.id)}
                className={cn(
                  "h-auto flex-col items-stretch gap-2 rounded-2xl border bg-card p-2 hover:bg-muted/40",
                  selected && "border-primary ring-2 ring-primary/20",
                )}
              >
                {/* Aperçu illustratif du thème : couleurs littérales volontaires. */}
                <span aria-hidden="true" className={cn("flex h-20 items-center justify-center rounded-xl border", item.preview)}>
                  <span className={cn("h-1/2 w-1/2 rounded-md shadow-xs", item.inner)} />
                </span>
                <span className="flex items-center justify-center gap-1.5 text-sm font-medium">
                  {selected && <Check aria-hidden="true" className="size-3.5" />}
                  {item.label}
                </span>
              </Button>
            );
          })}
        </div>
      </SettingsSection>

      <SettingsSection
        icon={AlertTriangle}
        title="Zone sensible"
        description="Ces actions sont définitives."
        danger
      >
        <div className="flex flex-col justify-between gap-4 rounded-2xl border border-destructive/30 bg-card p-5 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-medium">Supprimer le compte</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Supprime votre profil et les projets dont vous êtes l’unique membre.
              Les projets partagés doivent d’abord être transférés.
            </p>
          </div>
          <DeleteAccountDialog email={email} plan={deletionPlan} sessionCreatedAt={sessionCreatedAt} />
        </div>
      </SettingsSection>
    </>
  );
}

/** Two-column settings row: title and description on the left, content on the right. */
export function SettingsSection({
  icon: Icon,
  title,
  description,
  aside,
  danger = false,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  aside?: React.ReactNode;
  danger?: boolean;
  children: React.ReactNode;
}) {
  const id = `section-${title.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <section aria-labelledby={id} className="grid gap-4 border-t pt-8 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] md:gap-10">
      <div>
        <h2 id={id} className={cn("flex items-center gap-2 font-heading text-base font-semibold tracking-tight", danger && "text-destructive")}>
          <Icon aria-hidden="true" className="size-4" />
          {title}
          {aside}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}
