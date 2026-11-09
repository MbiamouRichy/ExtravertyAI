import type { Metadata } from "next";
import Link from "next/link";
import { can, homePath } from "@/lib/project-permissions";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, Check, KanbanSquare } from "lucide-react";

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth-server";
import { minimumPlanFor, planAllows, planUpgradeMessage } from "@/lib/plan-features";
import { formatPlanPrice, pricingPlan } from "@/lib/pricing";
import { keptPipelineCount, pipelineBoard } from "@/lib/pipeline";
import { followUpSettings, followUpStats } from "@/lib/follow-ups";
import { Button } from "@/components/ui/button";
import { PipelineBoard } from "@/components/dashboard/project/pipeline-board";
import { FollowUpPanel } from "@/components/dashboard/project/follow-up-panel";

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
      project: {
        select: {
          name: true,
          plan: true,
          deletionPending: true,
          followUpEnabled: true,
          followUpInterestedDays: true,
          followUpQuoteDays: true,
          followUpMax: true,
          followUpTemplate: true,
        },
      },
    },
  });
  if (!membership || membership.project.deletionPending) notFound();
  if (!can(membership.role, "pipeline.view")) redirect(homePath(projectId, membership.role));
  const canManage = can(membership.role, "project.manage");

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
    const current = pricingPlan(membership.project.plan);
    const target = pricingPlan(minimumPlanFor("pipeline"));
    // Aucune donnée n'est effacée : on le montre plutôt que de le promettre.
    const kept = await keptPipelineCount(prisma, projectId);
    return (
      <main className="mx-auto w-full max-w-5xl space-y-8 p-4 sm:p-6 xl:p-8">
        {header}
        <section
          aria-labelledby="pipeline-upgrade-title"
          className="rounded-2xl border bg-card p-6 sm:p-8"
        >
          <span className="flex size-11 items-center justify-center rounded-xl border bg-muted/50">
            <KanbanSquare aria-hidden="true" className="size-5" />
          </span>
          <p className="mt-4 font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Offre {target.name}
            {` · ${formatPlanPrice(target.priceCents)} / mois`}
          </p>
          <h2
            id="pipeline-upgrade-title"
            className="mt-1 font-heading text-lg font-semibold tracking-tight"
          >
            {planUpgradeMessage("pipeline")}
          </h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Votre projet est sur l’offre {current.name}. Passez à {target.name} pour
            suivre chaque affaire jusqu’à la vente et ne plus laisser un devis sans suite.
          </p>
          <ul className="mt-5 grid max-w-2xl gap-2.5 text-sm sm:grid-cols-2 sm:gap-x-6">
            {[
              "Un tableau de Nouveau à Gagné, rempli par Instinct IA",
              "La valeur de chaque affaire et le chiffre gagné",
              "Des diffusions ciblées par étape du pipeline",
              "Des relances automatiques des prospects silencieux",
              "Chaque changement d’étape envoyé à vos outils",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
          {kept > 0 && (
            <p className="mt-5 max-w-xl rounded-lg border bg-muted/40 px-3.5 py-2.5 text-sm">
              {kept === 1
                ? "Votre prospect déjà suivi est conservé, avec son étape et son montant."
                : `Vos ${kept.toLocaleString("fr-FR")} prospects déjà suivis sont conservés, avec leur étape et leur montant.`}{" "}
              <span className="text-muted-foreground">
                Ils réapparaissent tels quels dès le passage à {target.name}.
              </span>
            </p>
          )}
          {/* Seuls ceux qui peuvent changer d'offre voient le bouton (facturation revérifiée côté serveur). */}
          {can(membership.role, "billing.manage") ? (
            <Button asChild className="mt-6">
              <Link href={`/projects/${projectId}/billing`}>
                Passer à {target.name}
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          ) : (
            <p className="mt-6 text-sm text-muted-foreground">
              Demandez au propriétaire du projet de passer à l’offre {target.name}.
            </p>
          )}
        </section>
      </main>
    );
  }

  const [board, stats] = await Promise.all([
    pipelineBoard(prisma, projectId, session.user.id),
    followUpStats(prisma, projectId),
  ]);
  if (!board) notFound();
  const followUp = followUpSettings(membership.project);

  return (
    <main className="mx-auto w-full max-w-400 space-y-6 p-4 sm:p-6 xl:p-8">
      {header}
      <FollowUpPanel
        // Réglages changés ailleurs (autre administrateur) : le panneau repart des valeurs enregistrées.
        key={JSON.stringify(followUp)}
        projectId={projectId}
        initial={followUp}
        stats={stats}
        currency={board.currency}
        canManage={canManage}
      />
      <PipelineBoard
        projectId={projectId}
        currency={board.currency}
        columns={board.columns}
        canManage={canManage}
      />
    </main>
  );
}
