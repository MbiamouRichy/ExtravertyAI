import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { cookies } from "next/headers";
import { LogoIcon } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { DELETION_FEEDBACK_COOKIE } from "@/lib/account-deletion-records";
import { ExitSurvey } from "./exit-survey";

export const metadata: Metadata = {
  title: "Compte supprimé | ExtravertyAI",
  description: "Votre compte ExtravertyAI a été supprimé.",
  robots: { index: false, follow: false },
};

// Mirrors what the deletion flow actually does (lib/auth.ts before-hook →
// lib/project-deletion.ts, then Prisma cascades on the user row).
const completed = [
  "Projets, conversations, contacts et médias effacés",
  "Abonnements annulés, plus aucun prélèvement",
  "Numéros WhatsApp déconnectés",
  "Accès aux équipes et sessions retirés",
] as const;

export default async function GoodbyePage() {
  const canAnswerSurvey = (await cookies()).has(DELETION_FEEDBACK_COOKIE);
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="mx-auto flex w-full max-w-5xl items-center px-4 py-5 sm:px-6">
        <Link
          href="/"
          aria-label="ExtravertyAI — accueil"
          className="rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <LogoIcon LogoClassName="w-6" className="gap-1" />
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 pb-16 pt-4 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500">
        <span className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check aria-hidden className="size-5" strokeWidth={2.5} />
        </span>
        <h1 className="mt-6 text-3xl! leading-tight! tracking-tight! sm:text-4xl!">
          Compte supprimé
        </h1>
        <p className="mt-2 text-pretty text-muted-foreground">
          Vos données ont été effacées définitivement. Merci d’avoir fait
          confiance à ExtravertyAI.
        </p>

        <section
          aria-labelledby="goodbye-summary"
          className="mt-8 rounded-xl border bg-card p-4 text-card-foreground sm:p-5"
        >
          <h2
            id="goodbye-summary"
            className="font-sans! text-xs! font-medium! uppercase tracking-widest! text-muted-foreground"
          >
            Ce qui a été fait
          </h2>
          <ul className="mt-3 space-y-2.5 text-sm">
            {completed.map((item) => (
              <li key={item} className="flex gap-2.5">
                <Check
                  aria-hidden
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                />
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">
            Vos données de facturation ont aussi été effacées chez notre
            prestataire de paiement, qui ne garde que les justificatifs déjà
            émis, comme l’exige la loi.
          </p>
        </section>

        {/* Shown only right after a real deletion (one-time cookie). */}
        {canAnswerSurvey && <ExitSurvey className="mt-8" />}

        <div className="mt-10 flex flex-col gap-2 sm:flex-row">
          <Button asChild size="lg" className="group sm:flex-1">
            <Link href="/">
              Retour à l’accueil
              <ArrowRight
                data-icon="inline-end"
                aria-hidden
                className="motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5"
              />
            </Link>
          </Button>
          <Button asChild variant="ghost" size="lg" className="sm:flex-1">
            <Link href="/sign-up">Créer un nouveau compte</Link>
          </Button>
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          Votre adresse e-mail est de nouveau libre. Une question sur vos
          données&nbsp;?{" "}
          <Link
            href="/contact"
            className="font-medium text-foreground underline underline-offset-4 hover:no-underline"
          >
            Écrivez-nous
          </Link>
        </p>
      </main>
    </div>
  );
}
