"use client";

import React, { useState, useTransition } from "react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client"; // Ajuste le chemin vers ton client better-auth
import { updateThemeAction } from "@/app/actions/user"; // Ajuste le chemin

import {
    Trash2,
    AlertTriangle,
    Loader2
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useHaptics } from "@/lib/webHaptics";

export default function UserSettingsPage() {
    const { playHaptic } = useHaptics();

    // Pour le thème
    const { theme, setTheme } = useTheme();
    const [isPendingTheme, startThemeTransition] = useTransition();

    // Pour la suppression
    const [isDeleting, setIsDeleting] = useState(false);
    const [openDeleteModal, setOpenDeleteModal] = useState(false);


    // --- GESTION DU THÈME ---
    const handleThemeChange = (newTheme: "light" | "dark" | "system") => {
        setTheme(newTheme); // 1. Mise à jour UI instantanée (optimiste)
        playHaptic("success")
        // 2. Enregistrement en base de données en arrière-plan
        startThemeTransition(async () => {
            const result = await updateThemeAction({ theme: newTheme });
            if (!result.success) {
                playHaptic("error")
                toast.error("Erreur lors de la sauvegarde du thème");
            }


        });
    };

    // --- GESTION DE LA SUPPRESSION DE COMPTE ---
    const handleDeleteAccount = async () => {
        setIsDeleting(true);
        try {
            // Utilisation du client better-auth pour supprimer l'utilisateur
            await authClient.deleteUser({
                callbackURL: "/sign-up",
                fetchOptions: {
                    onSuccess: () => {
                        toast.success("Un email de verification vous ete envoye clique sur le lien qu'il contient pour supprimer votre compte.",
                            {
                                position: "top-center"
                            }
                        );
                        playHaptic("success")
                    },
                    onError: () => {
                        toast.error("Impossible de supprimer le compte.", { position: "top-center" });
                        playHaptic("error")
                    }
                }
            });
        } catch {
            toast.error("Une erreur inattendue est survenue.", { position: "top-center" });
            playHaptic("error")
        } finally {
            setIsDeleting(false);
        }
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
                                <CardDescription>Personnalisez l&apos;interface selon vos préférences.</CardDescription>
                            </div>
                            {/* Petit loader discret si ça sauvegarde en base */}
                            {isPendingTheme && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

                            {/* Thème Clair */}
                            <Button
                                variant={theme === "light" ? "outline" : "ghost"}
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
                        <CardDescription>Les actions ci-dessous sont irréversibles.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 border border-destructive/20 rounded-lg bg-background">
                            <div>
                                <h4 className="font-medium">Supprimer le compte</h4>
                                <p className="text-sm text-muted-foreground mt-1">Supprime définitivement vos données, bots et configurations.</p>
                            </div>

                            <AlertDialog open={openDeleteModal} onOpenChange={setOpenDeleteModal}>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" className="whitespace-nowrap shrink-0">
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        Supprimer mon compte
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Êtes-vous absolument sûr ?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Cette action est <strong>irréversible</strong>. Cela supprimera définitivement votre compte ainsi que toutes les données associées de nos serveurs.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel disabled={isDeleting}>Annuler</AlertDialogCancel>
                                        <Button
                                            variant="destructive"
                                            disabled={isDeleting}
                                            onClick={handleDeleteAccount}
                                        >
                                            {isDeleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                            Oui, supprimer mon compte
                                        </Button>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>

                        </div>
                    </CardContent>
                </Card>
            </div>

        </>
    );
}