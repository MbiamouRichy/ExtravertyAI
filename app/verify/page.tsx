"use client"
import Link from "next/link";
import { useSnapshot } from "valtio";

import { AuthSimpleShell } from "@/components/auth/auth-simple-shell";
import { Button } from "@/components/ui/button";
import { state } from "@/lib/proxy-state";

export default function VerifyPage() {
  const snap = useSnapshot(state)

  return (
    <AuthSimpleShell
      title="Vérifiez vos e-mails"
      description={
        // Reste volontairement conditionnel : ne confirme pas qu’un compte existe.
        <>
          Si un compte est associé à{" "}
          {snap.email ? (
            <span className="font-medium wrap-anywhere text-foreground">{snap.email}</span>
          ) : (
            "cette adresse"
          )}
          , vous recevrez un lien sous peu. Pensez à regarder dans vos courriers indésirables.
        </>
      }
    >
      <Button asChild variant="outline" size="lg" className="w-full">
        <Link href="/sign-in">Retour à la connexion</Link>
      </Button>
    </AuthSimpleShell>
  );
}
