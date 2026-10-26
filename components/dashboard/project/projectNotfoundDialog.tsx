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
import { FolderSearch, LayoutDashboard, ArrowLeft } from "lucide-react";
import { useState, useEffect } from "react";

interface ProjectNotFoundDialogProps {
    open: boolean;
}

export default function ProjectNotFoundDialog({ open }: ProjectNotFoundDialogProps) {
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(open);

    useEffect(() => {
        setIsOpen(open);
    }, [open]);

    // L'utilisateur ne peut pas rester sur une page de projet qui n'existe pas.
    // On force la navigation pour sortir de cette impasse.
    const handleGoBack = () => {
        setIsOpen(false);
        router.back();
    };

    const handleGoToDashboard = () => {
        setIsOpen(false);
        router.push("/projects");
    };

    return (
        <AlertDialog open={isOpen}>
            {/* L'absence de onOpenChange empêche la fermeture en cliquant à l'extérieur ou via Echap */}
            <AlertDialogContent className="max-w-md border-neutral-200 shadow-xl dark:border-neutral-800">
                <AlertDialogHeader className="flex flex-col items-center text-center space-y-4 sm:space-y-5 mt-4">

                    {/* Icône Premium : Tons neutres/doux pour signaler l'absence sans alarmer */}
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-100 ring-8 ring-neutral-50 dark:bg-neutral-800 dark:ring-neutral-900/50">
                        <FolderSearch className="h-8 w-8 text-neutral-500 dark:text-neutral-400" strokeWidth={1.5} />
                    </div>

                    <div className="space-y-2">
                        <AlertDialogTitle className="text-xl font-semibold tracking-tight">
                            Projet introuvable
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-base text-muted-foreground leading-relaxed">
                            Ce projet n&apos;existe pas ou a été supprimé. Veuillez vérifier le lien ou retourner à votre espace de travail.
                        </AlertDialogDescription>
                    </div>

                </AlertDialogHeader>

                <AlertDialogFooter className="flex-col sm:flex-row sm:justify-center gap-2 sm:space-x-0 mt-6 mb-2">
                    {/* Action Secondaire */}
                    <Button
                        variant="outline"
                        onClick={handleGoBack}
                        className="w-full sm:w-auto"
                    >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Retour
                    </Button>

                    {/* Action Primaire */}
                    <Button
                        variant="default"
                        onClick={handleGoToDashboard}
                        className="w-full sm:w-auto"
                    >
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        Mes projets
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}