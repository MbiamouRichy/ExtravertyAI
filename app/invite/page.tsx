import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth-server";
import { ArrowLeft, Link2Off } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { InviteShell } from "@/components/auth/invite-shell";
import { InviteForm } from "@/components/dashboard/project/invite-form";
import { consumeInvitation } from "../actions/invite";
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

  if (typeof token !== "string" || !token.trim() || token.length > 512) {
    return <ErrorState message="Lien d'invitation invalide ou manquant." />;
  }

  // 1. Vérifier l'invitation en base
  const invitation = await prisma.invitation.findUnique({
    where: { token },
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

  // 2. Gérer le cas où l'utilisateur est DÉJÀ connecté
  const session = await getSession();

  if (session?.user) {
    if (session.user.email === invitation.email) {
      // Auto-acceptation si c'est le bon email
      const result = await consumeInvitation(token);
      if (result.success) {
        redirect(`/projects/${result.projectId}`);
      }
      return (
        <ErrorState
          message={
            result.error ||
            "Impossible de rejoindre le projet. Veuillez réessayer."
          }
        />
      );
    } else {
      // Connecté avec un MAUVAIS email
      return (
        <ErrorState
          message={`Cette invitation est pour ${invitation.email}. Vous êtes connecté en tant que ${session.user.email}. Veuillez vous déconnecter d'abord.`}
        />
      );
    }
  }

  // 3. Afficher le formulaire de création de compte
  return (
    <InviteShell
      invitation={{
        projectName: invitation.project.name,
        inviterName: invitation.inviter.name || invitation.inviter.email,
      }}
    >
      <InviteForm
        email={invitation.email}
        token={token}
        projectName={invitation.project.name}
        inviterName={invitation.inviter.name || invitation.inviter.email}
      />
    </InviteShell>
  );
}

function ErrorState({ message }: { message: string }) {
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
          <Button asChild>
            <Link href="/sign-in">Accéder à mon compte</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/">
              <ArrowLeft aria-hidden />
              Retour à l’accueil
            </Link>
          </Button>
        </div>
      </div>
    </InviteShell>
  );
}
