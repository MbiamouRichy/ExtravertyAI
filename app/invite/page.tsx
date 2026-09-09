import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth-server";
import { XCircle } from "lucide-react";
import { InviteForm } from "@/components/dashboard/project/invite-form";
import { consumeInvitation } from "../actions/invite";

// 1. On type searchParams comme une Promesse
export default async function InvitePage({
    searchParams,
}: {
    searchParams: Promise<{ token?: string }>;
}) {
    // 2. On "await" searchParams avant de l'utiliser
    const { token } = await searchParams;

    if (!token) {
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
        return <ErrorState message="Cette invitation n'existe plus ou a déjà été utilisée." />;
    }

    if (invitation.expiresAt < new Date()) {
        return <ErrorState message="Ce lien d'invitation a expiré. Demandez-en un nouveau." />;
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
        <div className="relative flex min-h-screen items-center justify-center p-4">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-150 h-150 bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
            <InviteForm
                email={invitation.email}
                token={token}
                projectName={invitation.project.name}
                inviterName={invitation.inviter.name || invitation.inviter.email}
            />
        </div>
    );
}

// Sous-composant d'erreur (inchangé)
function ErrorState({ message }: { message: string }) {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 p-4">
            <div className="flex max-w-md flex-col items-center space-y-4 rounded-xl bg-background p-8 text-center shadow-sm border">
                <div className="rounded-full bg-destructive/10 p-3">
                    <XCircle className="h-8 w-8 text-destructive" />
                </div>
                <h2 className="text-xl font-semibold tracking-tight">Invitation invalide</h2>
                <p className="text-sm text-muted-foreground">{message}</p>
            </div>
        </div>
    );
}