"use client";

import { useRouter } from "next/navigation";
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { ShieldAlert, ArrowLeft, LayoutDashboard } from "lucide-react";
import { useState, useEffect } from "react";

interface UnauthorizedDialogProps {
    open: boolean;
    // Optionnel : un message personnalisé selon le rôle manquant
    message?: string;
}

export default function UnauthorizedDialog({
    open,
    message = "Vous n'avez pas les droits d'administration requis pour accéder à cette page ou effectuer cette action."
}: UnauthorizedDialogProps) {
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(open);

    // Synchronisation avec la prop externe
    useEffect(() => {
        setIsOpen(open);
    }, [open]);

    // UX : On ne permet pas de simplement fermer la modale si l'utilisateur est sur une page interdite.
    // Il faut le rediriger vers un endroit sûr (Retour ou Dashboard).

    const handleGoBack = () => {
        setIsOpen(false);
        router.back();
    };

    const handleGoToDashboard = () => {
        setIsOpen(false);
        router.push("/projects"); // Ajustez la route vers votre espace principal
    };

    return (
        <AlertDialog open={isOpen}>
            {/* On supprime le onOpenChange pour forcer l'utilisateur à cliquer sur l'un des boutons de navigation */}
            <AlertDialogContent className="max-w-md border-destructive/20 shadow-lg shadow-destructive/5">
                <AlertDialogHeader className="flex flex-col items-center text-center space-y-4 sm:space-y-5 mt-4">

                    {/* Icône Premium : Cercle avec background subtil et icône au centre */}
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 ring-8 ring-destructive/5">
                        <ShieldAlert className="h-8 w-8 text-destructive" strokeWidth={1.5} />
                    </div>

                    <div className="space-y-2">
                        <AlertDialogTitle className="text-xl font-semibold tracking-tight">
                            Accès restreint
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-base text-muted-foreground leading-relaxed">
                            {message}
                        </AlertDialogDescription>
                    </div>

                </AlertDialogHeader>

                <AlertDialogFooter className="flex-col sm:flex-row sm:justify-center gap-2 sm:space-x-0 mt-6 mb-2">
                    {/* Bouton Secondaire : Retour à la page précédente */}
                    <Button
                        variant="outline"
                        onClick={handleGoBack}
                        className="w-full sm:w-auto"
                    >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Page précédente
                    </Button>

                    {/* Bouton Primaire : Retour à l'accueil/dashboard */}
                    <Button
                        variant="default"
                        onClick={handleGoToDashboard}
                        className="w-full sm:w-auto bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
                    >
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        Mon tableau de bord
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}