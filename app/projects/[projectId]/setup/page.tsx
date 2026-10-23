import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Bot, Clock3, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth-server";
import prisma from "@/lib/prisma";
import { AgentEditor } from "@/components/dashboard/project/agent-editor";
import { AGENT_DEFAULTS, type AgentConfig } from "@/lib/agent-config";
import { knowledgeOverview } from "@/lib/knowledge";
import { SetupKnowledge } from "@/components/dashboard/project/knowledge/setup-knowledge";
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
      <main className="flex min-h-[70dvh] items-center justify-center p-4 sm:p-8">
        <section
          aria-labelledby="setup-wait-title"
          className="w-full max-w-md rounded-3xl border bg-card p-8 text-center"
        >
          <span className="mx-auto flex size-12 items-center justify-center rounded-2xl border bg-muted/50">
            <Clock3 aria-hidden="true" className="size-5" />
          </span>
          <h1 id="setup-wait-title" className="mt-5 text-2xl md:text-3xl">
            Votre agent se prépare
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Un propriétaire ou un administrateur de {p.name} doit terminer sa
            configuration avant l’ouverture de la messagerie.
          </p>
          <Button asChild variant="outline" className="mt-6">
            <Link href="/projects">
              <ArrowLeft data-icon="inline-start" />
              Retour aux projets
            </Link>
          </Button>
        </section>
      </main>
    );
  const initial = Object.fromEntries(
    Object.keys(AGENT_DEFAULTS).map((key) => [
      key,
      p[key as keyof typeof AGENT_DEFAULTS],
    ]),
  ) as AgentConfig;
  // Réservé OWNER/ADMIN côté serveur ; null si l’accès a changé entre-temps.
  const knowledge = await knowledgeOverview(prisma, projectId, session.user.id);
  const entryView = (
    entry: NonNullable<typeof knowledge>["entries"][number],
  ) => ({
    ...entry,
    updatedAt: entry.updatedAt.toISOString(),
  });
  return (
    <main className="mx-auto w-full max-w-6xl p-4 sm:p-6 xl:p-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="-ml-2 text-muted-foreground"
        >
          <Link href="/projects">
            <ArrowLeft data-icon="inline-start" />
            Mes projets
          </Link>
        </Button>
        <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs">
          <Bot aria-hidden="true" className="size-3.5 shrink-0" />
          <span className="truncate">{p.name}</span>
        </span>
      </div>

      <header className="mb-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="max-w-2xl">
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Configuration de l’agent
          </p>
          <h1 className="mt-2 text-[2.4rem] leading-[1.05] sm:text-5xl">
            Votre entreprise.
            <span className="block text-muted-foreground">
              La voix de votre agent.
            </span>
          </h1>
          <p className="mt-4 text-pretty text-muted-foreground">
            Avant ses premières conversations, donnez-lui une identité, une
            mission et une façon de répondre, puis, si vous le souhaitez, ce
            qu’il doit savoir. Tout reste modifiable dans Assistant IA.
          </p>
        </div>
        <ul className="flex flex-wrap gap-2 text-xs lg:flex-col lg:items-end">
          {[
            { icon: Clock3, text: "3 étapes + 1 facultative" },
            { icon: Sparkles, text: "Aperçu en direct du style" },
            { icon: ShieldCheck, text: "Visible uniquement par votre équipe" },
          ].map(({ icon: Icon, text }) => (
            <li
              key={text}
              className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1"
            >
              <Icon aria-hidden="true" className="size-3.5" />
              {text}
            </li>
          ))}
        </ul>
      </header>

      <AgentEditor
        key={p.agentConfigVersion}
        projectId={p.id}
        projectName={p.name}
        initial={initial}
        version={p.agentConfigVersion}
        onboarding
        dataStep={
          knowledge && (
            <SetupKnowledge
              projectId={p.id}
              currency={knowledge.currency}
              usage={knowledge.usage}
              entries={knowledge.entries.map(entryView)}
              products={knowledge.products.map(entryView)}
              sources={knowledge.sources.map((source) => ({
                ...source,
                processedAt: source.processedAt?.toISOString() ?? null,
                createdAt: source.createdAt.toISOString(),
              }))}
            />
          )
        }
      />
    </main>
  );
}
