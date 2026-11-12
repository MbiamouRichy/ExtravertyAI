import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth-server";
import { knowledgeOverview } from "@/lib/knowledge";
import { AGENT_DEFAULTS, type AgentConfig } from "@/lib/agent-config";
import { sandboxUsage } from "@/lib/agent-sandbox";
import { improvementOverview } from "@/lib/ai-feedback";
import { planAllows } from "@/lib/plan-features";
import { KnowledgeWorkspace } from "@/components/dashboard/project/knowledge/knowledge-workspace";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Assistant IA | ExtravertyAI",
  robots: { index: false, follow: false },
};

export default async function KnowledgePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const session = await getSession();
  if (!session?.user?.id) {
    redirect(`/sign-in?callbackUrl=${encodeURIComponent(`/projects/${projectId}/knowledge`)}`);
  }

  const header = (
    <header>
      <h1 className="text-2xl! font-semibold! tracking-tight! sm:text-3xl!">
        Assistant IA
      </h1>
    </header>
  );

  const overview = await knowledgeOverview(prisma, projectId, session.user.id);
  if (!overview) {
    const member = await prisma.projectMembership.findUnique({
      where: { userId_projectId: { userId: session.user.id, projectId } },
      select: { id: true },
    });
    if (!member) notFound();
    return (
      <main className="mx-auto w-full max-w-4xl space-y-6 p-4 sm:p-6 xl:p-8">
        {header}
        <section className="rounded-2xl border bg-card p-6">
          <ShieldCheck aria-hidden="true" className="size-5" />
          <h2 className="mt-3 font-heading text-lg font-semibold tracking-tight">
            Réservé aux propriétaires et administrateurs
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Demandez à un administrateur du projet d’ajouter les informations
            dont l’assistant a besoin.
          </p>
        </section>
      </main>
    );
  }

  const [sandbox, improvements, project] = await Promise.all([
    sandboxUsage(prisma, projectId, overview.plan),
    improvementOverview(prisma, projectId),
    prisma.project.findUniqueOrThrow({ where: { id: projectId } }),
  ]);
  // Projection explicite : seuls les réglages de l’agent quittent le serveur.
  const agentConfig = Object.fromEntries(
    Object.keys(AGENT_DEFAULTS).map((key) => [
      key,
      project[key as keyof typeof AGENT_DEFAULTS],
    ]),
  ) as AgentConfig;
  const iso = (date: Date | null) => date?.toISOString() ?? null;
  const entryView = (entry: (typeof overview.entries)[number]) => ({
    ...entry,
    updatedAt: entry.updatedAt.toISOString(),
  });

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 p-4 sm:p-6 xl:p-8">
      {header}
      <KnowledgeWorkspace
        projectId={projectId}
        agent={{
          projectName: project.name,
          config: agentConfig,
          version: project.agentConfigVersion,
          aiQuietEnabled: project.aiQuietEnabled,
          instinctAvailable: planAllows(project.plan, "instinct"),
        }}
        currency={overview.currency}
        usage={overview.usage}
        entries={overview.entries.map(entryView)}
        products={overview.products.map(entryView)}
        sources={overview.sources.map((source) => ({
          ...source,
          processedAt: iso(source.processedAt),
          createdAt: source.createdAt.toISOString(),
        }))}
        sandboxRemaining={sandbox.remaining}
        improvements={improvements}
      />
    </main>
  );
}
