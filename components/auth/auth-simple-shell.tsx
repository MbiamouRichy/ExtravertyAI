import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { LogoIcon } from "../logo";

/** Cadre des écrans de récupération de compte : une seule colonne, sans panneau latéral. */
export function AuthSimpleShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="flex min-h-dvh flex-col px-4 py-6 sm:px-10">
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <LogoIcon LogoClassName="w-6" className="gap-1.5" />
          <span className="sr-only">Retour à l’accueil</span>
        </Link>
        <Button asChild variant="ghost" size="sm">
          <Link href="/sign-in">
            <ArrowLeft data-icon="inline-start" />
            Connexion
          </Link>
        </Button>
      </div>

      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500">
        <h1 className="text-3xl md:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        <div className="mt-8">{children}</div>
        {footer && (
          <p className="mt-8 text-center text-sm text-muted-foreground">
            {footer}
          </p>
        )}
      </div>
    </main>
  );
}
