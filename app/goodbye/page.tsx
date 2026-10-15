import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  CircleCheck,
  CreditCard,
  FolderX,
  LogOut,
  MessageCircleOff,
  Users,
} from "lucide-react";
import { LogoIcon } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export const metadata: Metadata = {
  title: "Compte supprimé | ExtravertyAI",
  description: "Votre compte ExtravertyAI a été supprimé.",
  robots: { index: false, follow: false },
};
export const dynamic = "force-static";

// Mirrors what the deletion flow actually does (lib/auth.ts before-hook →
// lib/project-deletion.ts, then Prisma cascades on the user row).
const completed = [
  {
    icon: FolderX,
    title: "Projets supprimés",
    description:
      "Les projets dont vous étiez propriétaire, leurs conversations, contacts, médias et réglages d’agent ont été effacés.",
  },
  {
    icon: CreditCard,
    title: "Abonnements arrêtés",
    description:
      "Les abonnements liés à ces projets ont été annulés. Aucun nouveau prélèvement ne sera effectué.",
  },
  {
    icon: MessageCircleOff,
    title: "WhatsApp déconnecté",
    description:
      "Les numéros WhatsApp reliés à vos projets ne sont plus connectés à ExtravertyAI.",
  },
  {
    icon: Users,
    title: "Accès retirés",
    description:
      "Vos accès aux projets d’autres équipes et toutes vos sessions ont été supprimés.",
  },
] as const;

export default function GoodbyePage() {
  return (
    <div className="relative flex min-h-dvh flex-col bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-linear-to-b from-muted/60 to-transparent"
      />

      <header className="relative mx-auto flex w-full max-w-5xl items-center px-4 py-5 sm:px-6">
        <Link
          href="/"
          aria-label="ExtravertyAI — accueil"
          className="rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          <LogoIcon LogoClassName="w-6" className="gap-1" />
        </Link>
      </header>

      <main className="relative mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 pb-16 pt-6 sm:px-6 animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both">
        <div className="flex flex-col items-center text-center">
          <div className="mb-6 flex size-14 items-center justify-center rounded-2xl border bg-card shadow-sm">
            <CircleCheck className="size-7 text-foreground" aria-hidden />
          </div>
          <p className="mb-3 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <LogOut className="size-3.5" aria-hidden />
            Vous êtes déconnecté
          </p>
          <h1 className="text-3xl! leading-tight! tracking-tight! text-balance sm:text-4xl!">
            Votre compte a bien été supprimé
          </h1>
          <p className="mt-4 max-w-md text-pretty text-muted-foreground">
            Merci d’avoir confié vos conversations WhatsApp à ExtravertyAI.
            Voici ce qui a été fait.
          </p>
        </div>

        <section
          aria-labelledby="goodbye-summary"
          className="mt-10 rounded-xl border bg-card text-card-foreground shadow-sm"
        >
          <h2 id="goodbye-summary" className="sr-only">
            Récapitulatif de la suppression
          </h2>
          <ul className="divide-y">
            {completed.map(({ icon: Icon, title, description }) => (
              <li key={title} className="flex gap-4 p-4 sm:p-5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                  <Icon className="size-4.5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-medium leading-snug">
                    {title}
                    <Check
                      className="size-4 text-muted-foreground"
                      aria-label="terminé"
                    />
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {description}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <div className="mt-6 space-y-2 px-1 text-sm text-muted-foreground">
          <p>
            Cette suppression est définitive&nbsp;: vos anciennes données ne
            peuvent pas être restaurées. Votre adresse e-mail est libérée et
            peut servir à créer un nouveau compte.
          </p>
          <p>
            Les justificatifs de paiement déjà émis restent conservés par notre
            prestataire de paiement, conformément aux obligations légales.
          </p>
        </div>

        <Separator className="my-8" />

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-center">
          <Button asChild variant="outline" size="lg" className="px-5">
            <Link href="/sign-up">Créer un nouveau compte</Link>
          </Button>
          <Button asChild size="lg" className="group px-5">
            <Link href="/">
              Retour à l’accueil
              <ArrowRight
                data-icon="inline-end"
                className="transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
          </Button>
        </div>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          Une question sur vos données&nbsp;?{" "}
          <Link
            href="/contact"
            className="font-medium text-foreground underline-offset-4 hover:underline focus-visible:underline"
          >
            Écrivez-nous
          </Link>
        </p>
      </main>
    </div>
  );
}
