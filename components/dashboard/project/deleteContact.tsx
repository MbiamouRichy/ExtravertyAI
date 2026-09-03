"use client";

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
import { Loader2, Trash2, AlertTriangle } from "lucide-react";
import { useHaptics } from "@/lib/webHaptics";
import { deleteContact } from "@/app/actions/contacts.action";

interface DeleteContactProps {
    children: React.ReactNode;
    projectId: string;
    contact: {
        id: string;
        name: string | null;
        phone: string;
    };
}

export default function DeleteContact({ children, projectId, contact }: DeleteContactProps) {
    const [isPending, startTransition] = useTransition();
    const [open, setOpen] = useState<boolean>(false);
    const { playHaptic } = useHaptics();

    const displayName = contact.name || `+${contact.phone}`;

    const handleDelete = () => {
        startTransition(async () => {
            const result = await deleteContact(projectId, contact.id);

            if (result.success) {
                playHaptic("success");
                toast.success(`${displayName} a été supprimé définitivement.`);
                setOpen(false);
            } else {
                playHaptic("error");
                toast.error(result.error || "Erreur lors de la suppression.");
            }
        });
    };

    return (
        <AlertDialog open={open} onOpenChange={setOpen}>
            <AlertDialogTrigger asChild>
                {children}
            </AlertDialogTrigger>
            <AlertDialogContent className="border-destructive/20">
                <AlertDialogHeader>
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                            <AlertTriangle className="h-5 w-5 text-destructive" />
                        </div>
                        <AlertDialogTitle>Supprimer ce contact ?</AlertDialogTitle>
                    </div>
                    <AlertDialogDescription className="pt-2">
                        Vous êtes sur le point de supprimer <strong>{displayName}</strong>. Cette action est irréversible et supprimera également tout l&apos;historique de ses messages dans ce projet.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="mt-4">
                    <AlertDialogCancel disabled={isPending}>Annuler</AlertDialogCancel>
                    <Button
                        variant="destructive"
                        disabled={isPending}
                        onClick={handleDelete}
                    >
                        {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                        Oui, supprimer définitivement
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}