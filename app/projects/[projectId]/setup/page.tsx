import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Clock3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth-server";
import prisma from "@/lib/prisma";
import { can, homePath } from "@/lib/project-permissions";
import { AGENT_DEFAULTS, type AgentConfig } from "@/lib/agent-config";
import { knowledgeOverview } from "@/lib/knowledge";
import { sandboxUsage } from "@/lib/agent-sandbox";
import { ProjectIcon } from "@/components/dashboard/project/project-icon";
import { projectLogoUrl } from "@/lib/project-logo";
import { AgentSetup } from "@/components/dashboard/project/setup/agent-setup";
import { SetupKnowledge } from "@/components/dashboard/project/knowledge/setup-knowledge";

export const metadata: Metadata = {
  title: "Configurer votre assistant IA | ExtravertyAI",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

const DEFAULT_SUGGESTIONS = [
  "Bonjour, quels sont vos horaires ?",
  "Vous livrez en dehors de la capitale ?",
  "Comment puis-je passer commande ?",
];

/** Premières questions du test, tirées des données déjà saisies quand c’est possible. */
function testSuggestions(
  knowledge: NonNullable<Awaited<ReturnType<typeof knowledgeOverview>>> | null,
) {
  const short = (text: string) => text.trim().replace(/\s+/g, " ").slice(0, 80);
  const questions = (knowledge?.entries ?? [])
    .filter((entry) => entry.kind === "FAQ" && entry.enabled)
    .map((entry) => short(entry.title))
    .filter((title) => title.length > 3)
    .slice(0, 2);
  const product = knowledge?.products.find((entry) => entry.enabled);
  const fromData = [
    ...questions,
    ...(product ? [`Combien coûte « ${short(product.title)} » ?`] : []),
  ];
  return [...fromData, ...DEFAULT_SUGGESTIONS].slice(0, 3);
}

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
  if (p.agentSetupCompletedAt) redirect(homePath(projectId, membership.role));
  if (!can(membership.role, "project.manage"))
    return (
      <main className="flex min-h-[70dvh] items-center justify-center p-4 sm:p-8">
        <section
          aria-labelledby="setup-wait-title"
          className="w-full max-w-md text-center"
        >
          <span className="mx-auto flex size-12 items-center justify-center rounded-2xl border bg-muted/50">
            <Clock3 aria-hidden="true" className="size-5" />
          </span>
          <h1 id="setup-wait-title" className="mt-5 text-2xl md:text-3xl">
            Votre assistant se prépare
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
  const [knowledge, usage] = await Promise.all([
    knowledgeOverview(prisma, projectId, session.user.id),
    sandboxUsage(prisma, projectId, p.plan),
  ]);
  const entryView = (
    entry: NonNullable<typeof knowledge>["entries"][number],
  ) => ({
    ...entry,
    updatedAt: entry.updatedAt.toISOString(),
  });

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pt-4 sm:px-6 sm:pt-6 xl:px-8 xl:pt-8">
      <div className="mb-10 flex items-center justify-between gap-3">
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
        <span className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
          <ProjectIcon
            name={p.name}
            logoUrl={projectLogoUrl(p.id, p.logoKey)}
            className="size-6 rounded-md after:rounded-md"
            fallbackClassName="rounded-md text-[10px]"
          />
          <span className="truncate">{p.name}</span>
        </span>
      </div>

      <AgentSetup
        key={p.id}
        projectId={p.id}
        projectName={p.name}
        initial={initial}
        version={p.agentConfigVersion}
        sandbox={{
          remaining: usage.remaining,
          suggestions: testSuggestions(knowledge),
        }}
        knowledge={
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
