"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { CreditCard, RefreshCcw, ArrowLeft } from "lucide-react";

export default function PaymentCanceledDialog() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const isCanceled = searchParams.get("canceled") === "true";

    const handleClose = (redirectPath?: string) => {
        if (redirectPath) {
            router.push(redirectPath);
        } else {
            router.replace("/projects/new", { scroll: false });
        }
    };

    return (
        <AlertDialog open={isCanceled} onOpenChange={(isOpen) => !isOpen && handleClose()}>
            <AlertDialogContent className="max-w-md border-orange-200/50 shadow-xl shadow-orange-500/5 dark:border-orange-900/30">
                <AlertDialogHeader className="flex flex-col items-center text-center space-y-4 sm:space-y-5 mt-4">

                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-orange-100 ring-8 ring-orange-50 dark:bg-orange-500/10 dark:ring-orange-500/5">
                        <CreditCard className="h-8 w-8 text-orange-600 dark:text-orange-500" strokeWidth={1.5} />
                    </div>

                    <div className="space-y-2">
                        <AlertDialogTitle className="text-xl font-semibold tracking-tight">
                            Paiement interrompu
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-base text-muted-foreground leading-relaxed">
                            La création de votre projet a été annulée ou une erreur est survenue lors de la transaction. <br className="hidden sm:block" />
                            <strong className="text-foreground font-medium">Ne vous inquiétez pas, aucun montant n&apos;a été débité.</strong>
                        </AlertDialogDescription>
                    </div>

                </AlertDialogHeader>

                <AlertDialogFooter className="flex-col sm:flex-row sm:justify-center gap-2 sm:space-x-0 mt-6 mb-2">
                    <Button
                        variant="outline"
                        onClick={() => handleClose("/projects")}
                        className="w-full sm:w-auto"
                    >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Annuler la création
                    </Button>

                    <Button
                        variant="default"
                        onClick={() => handleClose()}
                        className="w-full sm:w-auto bg-orange-600 hover:bg-orange-700 text-white dark:bg-orange-600 dark:hover:bg-orange-700"
                    >
                        <RefreshCcw className="mr-2 h-4 w-4" />
                        Réessayer le paiement
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}