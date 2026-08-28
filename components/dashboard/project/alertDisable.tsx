"use client";

import { disableProject } from "@/app/actions/projects";
import { useState, useTransition } from "react";
import { toast } from "sonner";
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
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useHaptics } from "@/lib/webHaptics";

export default function AlertDisable({ project }: { project: { id: string; status: string } }) {
    const [isPending, startTransition] = useTransition();
    const [open, setOpen] = useState<boolean>(false);
    const { playHaptic } = useHaptics();

    const isPaused = project.status === "paused";

    const handleToggleProject = () => {
        startTransition(async () => {
            const result = await disableProject({ projectId: project.id });

            if (result.success) {
                playHaptic("success");
                toast.success(`Projet ${!isPaused ? "désactivé" : "réactivé"} avec succès.`);
                setOpen(false); // On ferme la modale manuellement après le succès
            } else {
                playHaptic("error");
                toast.error(result.error || "Erreur lors de l'opération");
            }
        });
    };

    // --- SI LE PROJET EST ACTIF / EN ESSAI (Bouton Désactiver + Modale) ---
    if (!isPaused) {
        return (
            <AlertDialog open={open} onOpenChange={setOpen}>
                <AlertDialogTrigger asChild>
                    <Button
                        variant="destructive"
                        className="w-full sm:w-auto"
                        disabled={isPending}
                    >
                        Désactiver
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Êtes-vous sûr ?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Cette action va mettre le projet en pause. Le projet ne recevra plus de messages et l&apos;instance WhatsApp sera déconnectée.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isPending}>Annuler</AlertDialogCancel>
                        {/* 
                            On utilise un <Button> standard au lieu de <AlertDialogAction> 
                            pour éviter que la modale ne se ferme instantanément au clic.
                            Cela permet de voir le Loader tourner pendant le chargement.
                        */}
                        <Button
                            variant="destructive"
                            disabled={isPending}
                            onClick={handleToggleProject}
                        >
                            {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                            Oui, désactiver
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        );
    }

    // --- SI LE PROJET EST EN PAUSE (Bouton Réactiver direct, sans modale) ---
    return (
        <Button
            variant="default"
            className="w-full sm:w-auto"
            onClick={handleToggleProject}
            disabled={isPending}
        >
            {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Réactiver
        </Button>
    );
}