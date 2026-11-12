import type { Metadata } from "next";
import Link from "next/link";
import { can, homePath } from "@/lib/project-permissions";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, Plus } from "lucide-react";
import { z } from "zod";

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth-server";
import { broadcastUsage, listBroadcasts, listOptedOut } from "@/lib/broadcasts";
import {
  PLAN_FEATURES,
  minimumPlanFor,
  planAllows,
  planUpgradeMessage,
  plansWith,
} from "@/lib/plan-features";
import { pricingPlan } from "@/lib/pricing";
import { Button } from "@/components/ui/button";
import { BroadcastsWorkspace } from "@/components/dashboard/project/broadcasts/broadcasts-workspace";
import { OptedOutPanel } from "@/components/dashboard/project/broadcasts/opted-out-panel";
import { SectionTabs } from "@/components/dashboard/project/broadcasts/section-tabs";
import { ACTIVE_STATUSES, type BroadcastView } from "@/components/dashboard/project/broadcasts/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Diffusions | ExtravertyAI",
  robots: { index: false, follow: false },
};

export default async function BroadcastsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  if (!z.string().cuid().safeParse(projectId).success) notFound();
  const session = await getSession();
  if (!session?.user?.id) {
    redirect(`/sign-in?callbackUrl=${encodeURIComponent(`/projects/${projectId}/broadcasts`)}`);
  }
  const userId = session.user.id;
  const membership = await prisma.projectMembership.findUnique({
    where: { userId_projectId: { userId, projectId } },
    select: {
      role: true,
      project: { select: { name: true, plan: true, timeZone: true, deletionPending: true, instanceStatus: true } },
    },
  });
  if (!membership || membership.project.deletionPending) notFound();
  if (!can(membership.role, "pipeline.view")) redirect(homePath(projectId, membership.role));
  const canManage = can(membership.role, "project.manage");
  const allowed = planAllows(membership.project.plan, "broadcast");

  const [broadcasts, usage, optedOut, optedOutTotal] = await Promise.all([
    listBroadcasts(prisma, projectId),
    broadcastUsage(prisma, { id: projectId, ...membership.project }),
    listOptedOut(prisma, { projectId, userId }),
    prisma.contact.count({ where: { projectId, broadcastOptOutAt: { not: null } } }),
  ]);

  const active = broadcasts.find((broadcast) => ACTIVE_STATUSES.includes(broadcast.status));
  const header = (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">Diffusions</h1>
        <p className="truncate text-sm text-muted-foreground">{membership.project.name}</p>
      </div>
      {canManage &&
        allowed &&
        !!broadcasts.length &&
        (active ? (
          <p className="max-w-64 text-xs text-muted-foreground sm:text-right">
            Une seule diffusion à la fois : « {active.name} » est en cours.
          </p>
        ) : (
          <Button asChild>
            <Link href={`/projects/${projectId}/broadcasts/new`}>
              <Plus data-icon="inline-start" />
              Nouvelle diffusion
            </Link>
          </Button>
        ))}
    </header>
  );

  const upsell = (
    <section className="rounded-xl border bg-card p-4 sm:p-5">
      <h2 className="text-sm font-medium">{planUpgradeMessage("broadcast")}</h2>
      <ul className="mt-3 max-w-xl list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
        {/* Limites lues dans PLAN_FEATURES : elles ne peuvent pas diverger des contrôles serveur. */}
        {plansWith("broadcast").map((plan) => (
          <li key={plan}>
            {pricingPlan(plan).name} : {PLAN_FEATURES[plan].broadcastRecipients.toLocaleString("fr-FR")}{" "}
            contacts par diffusion et {PLAN_FEATURES[plan].broadcastMonthly.toLocaleString("fr-FR")} messages
            de diffusion par mois.
          </li>
        ))}
        <li>
          Ciblage par étiquette et activité récente, envoi programmé. Ciblage par étape du pipeline avec
          l’offre {pricingPlan(minimumPlanFor("pipeline")).name}.
        </li>
        <li>Suivi des messages distribués, lus et des réponses.</li>
      </ul>
      {canManage ? (
        <Button asChild className="mt-4">
          <Link href={`/projects/${projectId}/billing`}>
            Voir les offres
            <ArrowRight data-icon="inline-end" />
          </Link>
        </Button>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          Demandez à un propriétaire ou à un administrateur de changer d’offre.
        </p>
      )}
    </section>
  );

  // Without the feature and without history: only the offer is shown.
  if (!allowed && !broadcasts.length) {
    return (
      <main className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8">
        {header}
        {upsell}
      </main>
    );
  }

  const views: BroadcastView[] = broadcasts.map((broadcast) => ({
    id: broadcast.id,
    name: broadcast.name,
    status: broadcast.status,
    pauseReason: broadcast.pauseReason,
    scheduledAt: broadcast.scheduledAt.toISOString(),
    nextSendAt: broadcast.nextSendAt.toISOString(),
    startedAt: broadcast.startedAt?.toISOString() ?? null,
    finishedAt: broadcast.finishedAt?.toISOString() ?? null,
    createdAt: broadcast.createdAt.toISOString(),
    recipientCount: broadcast.recipientCount,
    author: broadcast.createdBy?.name?.trim().split(/\s+/)[0] ?? null,
    hasImage: !!broadcast.mediaUrl,
    stats: broadcast.stats,
  }));

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8">
      {header}
      {!allowed && upsell}
      <SectionTabs
        label="Sections des diffusions"
        tabs={[
          {
            id: "diffusions",
            label: "Diffusions",
            count: broadcasts.length,
            content: (
              <BroadcastsWorkspace
                projectId={projectId}
                canManage={canManage}
                canCreate={canManage && allowed}
                connected={membership.project.instanceStatus === "connected"}
                broadcasts={views}
                usage={usage}
              />
            ),
          },
          {
            id: "desinscrits",
            label: "Désinscrits",
            count: optedOutTotal,
            content: <OptedOutPanel projectId={projectId} total={optedOutTotal} initial={optedOut} />,
          },
        ]}
      />
    </main>
  );
}
