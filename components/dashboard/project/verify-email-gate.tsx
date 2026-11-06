import Link from "next/link";
import { ArrowLeft, MailCheck } from "lucide-react";

import { ReauthButton } from "../user/recent-session";

/**
 * Création de projet réservée aux adresses confirmées : l'essai gratuit est lié
 * à un e-mail dont la possession a été prouvée. Le serveur le revérifie.
 */
export function VerifyEmailGate({
  email,
  callbackUrl,
}: {
  email: string;
  callbackUrl: string;
}) {
  return (
    <div className="mx-auto w-full max-w-xl px-4 pt-6 pb-16 sm:px-6 sm:pt-10">
      <Link
        href="/projects"
        className="-ml-1 inline-flex min-h-11 items-center gap-2 rounded-md px-1 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Mes projets
      </Link>
      <section
        aria-labelledby="verify-email-title"
        className="mt-6 rounded-xl border p-6 sm:p-8"
      >
        <span className="flex size-10 items-center justify-center rounded-full bg-muted">
          <MailCheck aria-hidden className="size-5" />
        </span>
        <h1
          id="verify-email-title"
          className="mt-4 text-xl! font-semibold! tracking-tight!"
        >
          Confirmez votre adresse e-mail
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Pour créer un projet et démarrer l’essai gratuit, confirmez d’abord{" "}
          <strong className="font-medium break-all text-foreground">
            {email}
          </strong>
          . Reconnectez-vous : un code de vérification vous sera envoyé.
        </p>
        <ReauthButton
          callbackUrl={callbackUrl}
          label="Me reconnecter et confirmer"
          variant="default"
          className="mt-6 w-full sm:w-auto"
        />
      </section>
    </div>
  );
}
