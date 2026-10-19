import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, KanbanSquare } from "lucide-react";

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth-server";
import { planAllows, planUpgradeMessage } from "@/lib/plan-features";
import { pipelineBoard } from "@/lib/pipeline";
import { Button } from "@/components/ui/button";
import { PipelineBoard } from "@/components/dashboard/project/pipeline-board";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Pipeline | ExtravertyAI",
  robots: { index: false, follow: false },
};

export default async function PipelinePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const session = await getSession();
  if (!session?.user?.id) {
    redirect(
      `/sign-in?callbackUrl=${encodeURIComponent(`/projects/${projectId}/pipeline`)}`,
    );
  }
  const membership = await prisma.projectMembership.findUnique({
    where: { userId_projectId: { userId: session.user.id, projectId } },
    select: {
      role: true,
      project: { select: { name: true, plan: true, deletionPending: true } },
    },
  });
  if (!membership || membership.project.deletionPending) notFound();
  const canManage = membership.role === "OWNER" || membership.role === "ADMIN";

  const header = (
    <header>
      <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
        Pipeline · {membership.project.name}
      </p>
      <h1 className="mt-1 text-3xl md:text-4xl">Pipeline de prospects</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Suivez chaque prospect du premier message à la vente. Instinct IA place
        les contacts intéressés, votre équipe fait avancer le reste.
      </p>
    </header>
  );

  if (!planAllows(membership.project.plan, "pipeline")) {
    return (
      <main className="mx-auto w-full max-w-5xl space-y-8 p-4 sm:p-6 xl:p-8">
        {header}
        <section className="rounded-2xl border bg-card p-6 sm:p-8">
          <span className="flex size-11 items-center justify-center rounded-xl border bg-muted/50">
            <KanbanSquare aria-hidden="true" className="size-5" />
          </span>
          <h2 className="mt-4 font-heading text-lg font-semibold tracking-tight">
            {planUpgradeMessage("pipeline")}
          </h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Visualisez la valeur de vos affaires en cours, mesurez votre taux de
            conversion et ne laissez plus un devis sans suite.
          </p>
          {canManage ? (
            <Button asChild className="mt-5">
              <Link href={`/projects/${projectId}/billing`}>
                Voir les offres
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          ) : (
            <p className="mt-5 text-sm text-muted-foreground">
              Demandez à un propriétaire ou à un administrateur de changer d’offre.
            </p>
          )}
        </section>
      </main>
    );
  }

  const board = await pipelineBoard(prisma, projectId, session.user.id);
  if (!board) notFound();

  return (
    <main className="mx-auto w-full max-w-400 space-y-6 p-4 sm:p-6 xl:p-8">
      {header}
      <PipelineBoard
        projectId={projectId}
        currency={board.currency}
        columns={board.columns}
        canManage={canManage}
      />
    </main>
  );
}
