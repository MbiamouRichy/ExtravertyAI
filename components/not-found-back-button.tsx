"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

/** Revient à la page précédente ; sans historique (lien ouvert directement), va au repli. */
export function NotFoundBackButton({ fallbackHref }: { fallbackHref: string }) {
  const router = useRouter();
  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      onClick={() => {
        if (window.history.length > 1) router.back();
        else router.push(fallbackHref);
      }}
    >
      <ArrowLeft aria-hidden="true" data-icon="inline-start" />
      Retour
    </Button>
  );
}
