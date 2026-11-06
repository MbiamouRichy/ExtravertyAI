import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth-server";
import { ArrowLeft, Link2Off, LogIn } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { InviteShell } from "@/components/auth/invite-shell";
import { InviteForm } from "@/components/dashboard/project/invite-form";
import { InviteDecision } from "@/components/dashboard/project/invite-decision";
import { ReauthButton } from "@/components/dashboard/user/recent-session";
import {
  hashInvitationToken,
  isInvitationToken,
  sameEmail,
} from "@/lib/project-invitations";
import {
  ROLE_DESCRIPTIONS,
  isProjectRole,
  roleLabel,
} from "@/lib/project-permissions";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Invitation | ExtravertyAI",
  robots: { index: false, follow: false },
};

// 1. On type searchParams comme une Promesse
export default async function InvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  // 2. On "await" searchParams avant de l'utiliser
  const { token } = await searchParams;

  if (!isInvitationToken(token)) {
    return <ErrorState message="Lien d'invitation invalide ou manquant." />;
  }

  // 1. Vérifier l'invitation en base
  const invitation = await prisma.invitation.findUnique({
    where: { token: hashInvitationToken(token) },
    include: {
      project: { select: { name: true } },
      inviter: { select: { name: true, email: true } },
    },
  });

  if (!invitation) {
    return (
      <ErrorState message="Cette invitation n'existe plus ou a déjà été utilisée." />
    );
  }

  if (invitation.expiresAt < new Date()) {
    return (
      <ErrorState message="Ce lien d'invitation a expiré. Demandez-en un nouveau." />
    );
  }

  const inviterName = invitation.inviter.name || invitation.inviter.email;
  const card = { projectName: invitation.project.name, inviterName };
  const inviteUrl = "/invite?token=" + token;

  // 2. Ouvrir le lien n'accepte jamais rien : l'invité décide d'un clic explicite,
  // sinon un simple lien piégé suffirait à le faire entrer dans un projet.
  const session = await getSession();

  if (session?.user) {
    if (!sameEmail(session.user.email, invitation.email)) {
      return (
        <ErrorState
          message={`Cette invitation est pour ${invitation.email}. Vous êtes connecté en tant que ${session.user.email}.`}
          switchAccountUrl={inviteUrl}
        />
      );
    }
    return (
      <InviteShell invitation={card}>
        <InviteDecision
          token={token}
          email={invitation.email}
          projectName={invitation.project.name}
          inviterName={inviterName}
          roleLabel={roleLabel(invitation.role)}
          roleDescription={
            isProjectRole(invitation.role)
              ? ROLE_DESCRIPTIONS[invitation.role]
              : ""
          }
        />
      </InviteShell>
    );
  }

  // 3. Compte existant : connexion d'abord, la décision vient ensuite.
  const account = await prisma.user.findUnique({
    where: { email: invitation.email },
    select: { id: true },
  });
  if (account) {
    return (
      <InviteShell invitation={card}>
        <div className="space-y-6">
          <header className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Invitation à collaborer
            </p>
            <h1 className="text-3xl md:text-4xl">
              Connectez-vous pour répondre.
            </h1>
            <p className="break-words text-sm leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">{inviterName}</span>{" "}
              vous invite à rejoindre{" "}
              <span className="font-medium text-foreground">
                {invitation.project.name}
              </span>
              . Connectez-vous avec {invitation.email} pour accepter ou refuser.
            </p>
          </header>
          <Button asChild size="lg" className="w-full">
            <Link href={"/sign-in?callbackUrl=" + encodeURIComponent(inviteUrl)}>
              <LogIn data-icon="inline-start" />
              Se connecter
            </Link>
          </Button>
        </div>
      </InviteShell>
    );
  }

  // 4. Afficher le formulaire de création de compte
  return (
    <InviteShell invitation={card}>
      <InviteForm
        email={invitation.email}
        token={token}
        projectName={invitation.project.name}
        inviterName={inviterName}
      />
    </InviteShell>
  );
}

function ErrorState({
  message,
  switchAccountUrl,
}: {
  message: string;
  /** Connecté avec un autre compte : reconnexion, retour sur l’invitation. */
  switchAccountUrl?: string;
}) {
  return (
    <InviteShell>
      <div className="space-y-6">
        <div className="flex size-12 items-center justify-center rounded-2xl border bg-muted/50">
          <Link2Off aria-hidden className="size-6 text-muted-foreground" />
        </div>
        <div className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Invitation indisponible
          </p>
          <h1 className="text-3xl md:text-4xl">
            Retrouvons votre équipe.
          </h1>
          <p className="break-words text-sm leading-relaxed text-muted-foreground">
            {message}
          </p>
        </div>
        <p className="rounded-xl border border-dashed p-4 text-sm leading-relaxed">
          Demandez à la personne qui vous invite de vous envoyer un nouveau
          lien, puis ouvrez-le depuis son message.
        </p>
        <div className="flex flex-col gap-3">
          <Button asChild variant="ghost">
            <Link href="/">
              <ArrowLeft aria-hidden />
              Retour à l’accueil
            </Link>
          </Button>
          {switchAccountUrl ? (
            <ReauthButton
              callbackUrl={switchAccountUrl}
              label="Changer de compte"
              variant="outline"
            />
          ) : (
            <>
              <Button asChild variant="outline">
                <Link href="/sign-in">Accéder à mon compte</Link>
              </Button>
              <Button asChild>
                <Link href="/sign-up">Créer mon compte</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </InviteShell>
  );
}
