import type { ReactNode } from "react";
import Link from "next/link";
import { Inbox, Sparkles, UsersRound } from "lucide-react";

import { getInitials } from "@/components/getInitials";
import { LogoIcon } from "@/components/logo";

type Invitation = { projectName: string; inviterName: string };

const perks = [
  { icon: Inbox, text: "La messagerie WhatsApp partagée du projet" },
  { icon: Sparkles, text: "Les prospects repérés par Instinct IA" },
  { icon: UsersRound, text: "Une équipe qui voit qui répond à qui" },
];

function InvitationCard({ invitation }: { invitation?: Invitation }) {
  return (
    <aside
      aria-label="Votre invitation"
      className="relative isolate hidden overflow-hidden bg-primary p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-center"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(var(--primary-foreground)_1px,transparent_1px)] opacity-10 mask-[radial-gradient(ellipse_at_top_right,black,transparent_70%)] bg-size-[20px_20px]"
      />
      <div className="mx-auto w-full max-w-md">
        <p className="font-mono text-xs uppercase tracking-[0.2em] opacity-60">
          {invitation ? "Invitation à collaborer" : "Travailler en équipe"}
        </p>
        {invitation ? (
          <div className="mt-6 rounded-2xl bg-primary-foreground p-6 text-primary shadow-2xl motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-500">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-full bg-primary font-heading text-sm font-semibold text-primary-foreground">
                {getInitials(invitation.inviterName)}
              </span>
              <p className="min-w-0 text-sm">
                <span className="block truncate font-semibold">{invitation.inviterName}</span>
                <span className="block opacity-60">vous invite à rejoindre</span>
              </p>
            </div>
            <p className="mt-5 break-words font-heading text-2xl font-bold">{invitation.projectName}</p>
          </div>
        ) : (
          <p className="mt-6 font-heading text-3xl leading-tight">
            Rejoignez votre équipe sur ExtravertyAI.
          </p>
        )}
        <ul className="mt-8 space-y-3">
          {perks.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3 text-sm">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary-foreground/10">
                <Icon aria-hidden="true" className="size-4" />
              </span>
              {text}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

export function InviteShell({
  children,
  invitation,
}: {
  children: ReactNode;
  invitation?: Invitation;
}) {
  return (
    <main className="grid min-h-svh bg-background text-foreground lg:grid-cols-2">
      <div className="flex flex-col px-4 py-6 sm:px-10">
        <Link
          href="/"
          className="self-start rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <LogoIcon LogoClassName="w-6" className="gap-1.5" />
          <span className="sr-only">ExtravertyAI — Accueil</span>
        </Link>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500">
          {children}
        </div>
        <p className="text-center text-xs text-muted-foreground">
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
      <InvitationCard invitation={invitation} />
    </main>
  );
}
