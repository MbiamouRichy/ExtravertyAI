import { chatContactName } from "@/lib/chat-privacy";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MessageCircle, WifiOff } from "lucide-react";

import { getProjectById } from "@/app/actions/projects";
import { getSession } from "@/lib/auth-server";

import ProjectWorkspace from "@/components/dashboard/project/whatsappSendMessageForm";
import QRCodeScanner from "@/components/dashboard/project/qrCodeScanner";
import UnauthorizedDialog from "@/components/dashboard/project/unAuthorizedDialog";
import ProjectNotFoundDialog from "@/components/dashboard/project/projectNotfoundDialog";
import { ChatRefreshButton } from "@/components/dashboard/project/chat-refresh-button";

import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{
    [key: string]: string | string[] | undefined;
  }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { projectId } = await params;
  const project = await getProjectById(projectId);

  return {
    title: project
      ? `${project.name} · Conversations | ExtravertyAI`
      : "Conversations | ExtravertyAI",
    description: "Espace de gestion des conversations WhatsApp.",
    robots: { index: false, follow: false },
  };
}

export default async function ChatPage({ params, searchParams }: PageProps) {
  const [{ projectId }, query] = await Promise.all([params, searchParams]);

  const session = await getSession();

  if (!session?.user?.id) {
    const callbackUrl = `/projects/${encodeURIComponent(projectId)}/chat`;

    redirect(`/sign-in?${new URLSearchParams({ callbackUrl }).toString()}`);
  }

  const project = await getProjectById(projectId);

  if (!project) {
    return (
      <div className="flex min-h-[60dvh] items-center justify-center p-6">
        <ProjectNotFoundDialog open={true} />
      </div>
    );
  }

  if (!project.agentSetupCompletedAt) redirect(`/projects/${projectId}/setup`);
  const canManageAi =
    project.userRole === "OWNER" || project.userRole === "ADMIN";

  const requiresConnection =
    project.instanceStatus === "qr_ready" ||
    project.instanceStatus === "connecting" ||
    project.instanceStatus === "disconnected";

  if (requiresConnection) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-6 p-4 sm:p-6 xl:p-8">
        <header>
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Messagerie · {project.name}
          </p>
          <h1 className="mt-1 text-3xl md:text-4xl">Connecter WhatsApp</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Associez votre numéro pour que l’assistant et votre équipe puissent
            répondre à vos clients.
          </p>
        </header>

        {canManageAi ? (
          <QRCodeScanner projectId={project.id} />
        ) : (
          <section className="rounded-3xl border bg-card p-6 sm:p-8">
            <span className="flex size-11 items-center justify-center rounded-xl border bg-muted/50">
              <WifiOff aria-hidden="true" className="size-5" />
            </span>
            <h2 className="mt-4 font-heading text-lg font-semibold tracking-tight">
              Une reconnexion est nécessaire
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Demandez à un propriétaire ou à un administrateur du projet de
              reconnecter WhatsApp, puis vérifiez à nouveau.
            </p>
            <div className="mt-5">
              <ChatRefreshButton />
            </div>
          </section>
        )}
      </div>
    );
  }

  if (project.instanceStatus !== "connected") {
    return (
      <div className="flex min-h-[60dvh] items-center justify-center p-6">
        <div
          role="status"
          className="w-full max-w-md rounded-2xl border bg-card p-6 text-center shadow-sm"
        >
          <MessageCircle
            aria-hidden="true"
            className="mx-auto mb-4 size-8 text-muted-foreground"
          />
          <h1 className="text-lg font-semibold">Instance non disponible</h1>
          <p className="mb-5 mt-2 text-sm leading-relaxed text-muted-foreground">
            La connexion WhatsApp n’est pas encore prête. Actualisez pour
            vérifier son état.
          </p>
          <ChatRefreshButton projectId={canManageAi ? project.id : undefined} />
        </div>
      </div>
    );
  }

  const requestedId =
    typeof query.contactId === "string" && query.contactId.length <= 200
      ? query.contactId
      : undefined;
  const contact = requestedId
    ? await prisma.contact.findFirst({
        where: { id: requestedId, projectId },
        select: {
          id: true,
          name: true,
          pushName: true,
          aiActive: true,
          lastMessageAt: true,
          createdAt: true,
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { content: true },
          },
        },
      })
    : null;
  const initialClient = contact
    ? {
        id: contact.id,
        name: chatContactName(contact),
        aiActive: contact.aiActive,
        lastActivityAt: (
          contact.lastMessageAt || contact.createdAt
        ).toISOString(),
        lastMessage: contact.messages[0]?.content || "",
      }
    : undefined;
  return (
    <>
      {query.error === "unauthorized" && <UnauthorizedDialog open={true} />}

      <ProjectWorkspace
        key={`${project.id}:${initialClient?.id || ""}`}
        initialClient={initialClient}
        project={{
          id: project.id,
          name: project.name,
          automationPaused: project.automationPaused,
        }}
        user={{
          id: session.user.id,
          name: session.user.name,
          image: session.user.image,
        }}
        isSuccess={query.success === "true"}
        canManageAi={true}
      />
    </>
  );
}
