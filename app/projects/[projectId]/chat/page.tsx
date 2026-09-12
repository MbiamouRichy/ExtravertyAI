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

export default async function ChatPage({
  params,
  searchParams,
}: PageProps) {
  const [{ projectId }, query] = await Promise.all([
    params,
    searchParams,
  ]);

  const session = await getSession();

  if (!session?.user?.id) {
    const callbackUrl =
      `/projects/${encodeURIComponent(projectId)}/chat`;

    redirect(
      `/sign-in?${new URLSearchParams({ callbackUrl }).toString()}`,
    );
  }

  const project = await getProjectById(projectId);

  if (!project) {
    return (
      <div className="flex min-h-[60dvh] items-center justify-center p-6">
        <ProjectNotFoundDialog open={true} />
      </div>
    );
  }

  const canManageAi =
    project.userRole === "OWNER" || project.userRole === "ADMIN";

  const requiresConnection =
    project.instanceStatus === "qr_ready" ||
    project.instanceStatus === "connecting" ||
    project.instanceStatus === "disconnected";

  if (requiresConnection) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-8">
        <header className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {project.name}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Connecter WhatsApp
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Connectez votre instance pour accéder aux conversations.
            Ne partagez pas le QR code de connexion.
          </p>
        </header>

        {canManageAi ? (
          <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <QRCodeScanner projectId={project.id} />
          </div>
        ) : (
          <div className="rounded-2xl border bg-card p-6">
            <WifiOff
              aria-hidden="true"
              className="mb-3 size-5 text-muted-foreground"
            />
            <p className="text-sm font-medium">
              Une reconnexion est nécessaire
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Demandez à un administrateur de reconnecter WhatsApp.
            </p>
          </div>
        )}

        <ChatRefreshButton />
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
          <h1 className="text-lg font-semibold">
            Instance non disponible
          </h1>
          <p className="mb-5 mt-2 text-sm leading-relaxed text-muted-foreground">
            La connexion WhatsApp n’est pas encore prête.
            Actualisez pour vérifier son état.
          </p>
          <ChatRefreshButton />
        </div>
      </div>
    );
  }

  return (
    <>
      {query.error === "unauthorized" && (
        <UnauthorizedDialog open={true} />
      )}

      <ProjectWorkspace
        key={project.id}
        project={{
          id: project.id,
          name: project.name,
        }}
        user={{
          id: session.user.id,
          name: session.user.name,
        }}
        isSuccess={query.success === "true"}
        canManageAi={
          project.userRole === "OWNER" ||
          project.userRole === "ADMIN"
        }
      />
    </>
  );
}