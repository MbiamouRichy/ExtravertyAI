import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Bot, ArrowLeft } from "lucide-react";
import { getSession } from "@/lib/auth-server";
import prisma from "@/lib/prisma";
import { AgentEditor } from "@/components/dashboard/project/agent-editor";
import { AGENT_DEFAULTS, type AgentConfig } from "@/lib/agent-config";
export const metadata: Metadata = {
  title: "Configurer votre agent IA | ExtravertyAI",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export default async function AgentSetupPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const session = await getSession();
  if (!session?.user?.id)
    redirect(
      `/sign-in?callbackUrl=${encodeURIComponent(`/projects/${projectId}/setup`)}`,
    );
  const membership = await prisma.projectMembership.findUnique({
    where: { userId_projectId: { userId: session.user.id, projectId } },
    include: { project: true },
  });
  if (!membership) notFound();
  const p = membership.project;
  if (p.agentSetupCompletedAt) redirect(`/projects/${projectId}/chat`);
  if (!["OWNER", "ADMIN"].includes(membership.role))
    return (
      <div className="mx-auto max-w-xl p-8">
        <h1 className="text-2xl font-semibold">Votre agent se prépare</h1>
        <p className="mt-4 text-muted-foreground">
          Un propriétaire ou administrateur doit terminer sa configuration avant
          l’ouverture du chat.
        </p>
        <Link href="/projects" className="mt-6 inline-block underline">
          Retour aux projets
        </Link>
      </div>
    );
  const initial = Object.fromEntries(
    Object.keys(AGENT_DEFAULTS).map((key) => [
      key,
      p[key as keyof typeof AGENT_DEFAULTS],
    ]),
  ) as AgentConfig;
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
      <Link
        href="/projects"
        className="mb-8 inline-flex min-h-10 items-center gap-2 text-sm text-muted-foreground"
      >
        <ArrowLeft className="size-4" /> Mes projets
      </Link>
      <div className="mb-10 max-w-2xl">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-foreground dark:bg-muted dark:text-foreground">
          <Bot className="size-3.5" /> Bienvenue dans {p.name}
        </div>
        <h1 className="text-3xl! font-semibold sm:text-4xl!">
          Votre entreprise.
          <br />
          La voix de votre agent.
        </h1>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          Avant ses premières conversations, définissez son identité, sa mission
          et sa façon de répondre. Vous pourrez tout ajuster dans les
          paramètres.
        </p>
      </div>
      <AgentEditor
        key={p.agentConfigVersion}
        projectId={p.id}
        projectName={p.name}
        initial={initial}
        version={p.agentConfigVersion}
        onboarding
      />
    </main>
  );
}
