"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, CreditCard } from "lucide-react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export default function PaymentCanceledDialog() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const isCanceled = searchParams.get("canceled") === "true";

  function dismissDialog() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("canceled");

    const query = params.toString();
    const hash = window.location.hash;

    router.replace(`${pathname}${query ? `?${query}` : ""}${hash}`, {
      scroll: false,
    });
  }

  return (
    <AlertDialog
      open={isCanceled}
      onOpenChange={(open) => {
        if (!open) dismissDialog();
      }}
    >
      <AlertDialogContent
        className="w-[calc(100%-2rem)] max-w-md gap-6 rounded-2xl border-border p-6 shadow-xl sm:p-8"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          document.getElementById("project-name")?.focus();
        }}
      >
        <AlertDialogHeader className="items-start space-y-4 text-left sm:text-left">
          <div className="flex size-12 items-center justify-center rounded-2xl border border-border/20 bg-primary/10">
            <CreditCard
              aria-hidden="true"
              className="size-6 text-foreground dark:text-foreground"
              strokeWidth={1.5}
            />
          </div>

          <div className="space-y-2">
            <AlertDialogTitle className="text-xl font-semibold tracking-tight">
              Vous avez quitté le paiement
            </AlertDialogTitle>

            <AlertDialogDescription className="text-sm leading-6">
              Vous êtes revenu depuis Stripe sans terminer ce parcours.
              Consultez vos projets pour vérifier leur état avant d’effectuer
              une nouvelle tentative.
            </AlertDialogDescription>
          </div>
        </AlertDialogHeader>

        <div className="rounded-xl border border-border bg-muted/50 p-4 text-sm leading-6 text-muted-foreground">
          Un projet en attente peut déjà avoir été créé. Le retour sur cette
          page ne confirme ni son activation, ni l’état d’un éventuel paiement.
        </div>

        <AlertDialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          <Button asChild className="min-h-11 w-full gap-2 rounded-xl">
            <Link href="/projects">
              Consulter mes projets
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </Button>

          <AlertDialogCancel className="mt-0 min-h-11 w-full rounded-xl">
            Fermer
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
