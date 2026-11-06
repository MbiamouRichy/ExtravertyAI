import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import { LogoIcon } from "@/components/logo";
import { Button } from "@/components/ui/button";
import {
  DELETION_FEEDBACK_COOKIE,
  findDeletionFeedbackSlot,
} from "@/lib/account-deletion-records";
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

async function deletionSlot() {
  const token = (await cookies()).get(DELETION_FEEDBACK_COOKIE)?.value;
  try {
    return await findDeletionFeedbackSlot(token);
  } catch (error) {
    // Fail closed: without proof of a deletion, the page stays out of reach.
    console.error("GOODBYE_SLOT_LOOKUP_FAILED", error);
    return null;
  }
}

export default async function GoodbyePage() {
  // Only the browser that has just deleted an account holds a live one-time
  // token (httpOnly cookie, 24 h). Visiting /goodbye otherwise leads home, so
  // nobody can stage a fake "account deleted" screen.
  const slot = await deletionSlot();
  if (!slot) redirect("/");

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

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 pb-16 pt-2 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500">
        <div className="flex items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check aria-hidden className="size-4" strokeWidth={2.5} />
          </span>
          <h1 className="text-2xl! leading-tight! tracking-tight! sm:text-3xl!">
            Compte supprimé
          </h1>
        </div>
        <p className="mt-3 text-pretty text-sm text-muted-foreground">
          Vos données ont été effacées définitivement. Merci d’avoir fait
          confiance à ExtravertyAI.
        </p>

        {/* First thing after the confirmation: the one question we ask. */}
        <ExitSurvey answered={slot.answered} className="mt-8" />

        <section aria-labelledby="goodbye-summary" className="mt-10">
          <h2
            id="goodbye-summary"
            className="font-sans! text-xs! font-medium! uppercase tracking-widest! text-muted-foreground"
          >
            Ce qui a été fait
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            {completed.map((item) => (
              <li key={item} className="flex gap-2.5">
                <Check aria-hidden className="mt-0.5 size-4 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            Vos données de facturation ont aussi été effacées chez notre
            prestataire de paiement, qui ne garde que les justificatifs déjà
            émis, comme l’exige la loi.
          </p>
        </section>

        <div className="mt-10 flex flex-col gap-2 border-t pt-6 sm:flex-row">
          <Button asChild variant="outline" size="lg" className="group sm:flex-1">
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
