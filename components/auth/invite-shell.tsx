import type { ReactNode } from "react";
import Link from "next/link";
import { LogoIcon } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { DecorIcon } from "@/components/ui/decor-icon";

export function InviteShell({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-6 py-16 text-foreground">
      <div className="relative w-full max-w-md border-y border-border px-1 py-8 sm:border sm:p-8">
        <DecorIcon position="top-left" />
        <DecorIcon position="bottom-right" />
        <Button
          asChild
          variant="ghost"
          className="mb-8 px-0 hover:bg-transparent"
        >
          <Link href="/" aria-label="ExtravertyAI — Accueil">
            <LogoIcon LogoClassName="size-7" className="gap-1" />
          </Link>
        </Button>
        {children}
        <p className="mt-8 border-t border-border pt-5 text-xs leading-relaxed text-muted-foreground">
          Votre espace de travail ExtravertyAI. Consultez notre{" "}
          <Link
            href="/donneesEtConfidentialite"
            className="underline underline-offset-4 hover:text-foreground"
          >
            politique de confidentialité
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
