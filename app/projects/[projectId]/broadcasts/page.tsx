import type { Metadata } from "next";
import Link from "next/link";
import { can, homePath } from "@/lib/project-permissions";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, Megaphone } from "lucide-react";
import { z } from "zod";

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth-server";
import { broadcastUsage, listBroadcasts, listOptedOut } from "@/lib/broadcasts";
import { planAllows, planUpgradeMessage } from "@/lib/plan-features";
import { Button } from "@/components/ui/button";
import { BroadcastsWorkspace } from "@/components/dashboard/project/broadcasts/broadcasts-workspace";
import { OptedOutPanel } from "@/components/dashboard/project/broadcasts/opted-out-panel";
import { SectionTabs } from "@/components/dashboard/project/broadcasts/section-tabs";
import type { BroadcastView } from "@/components/dashboard/project/broadcasts/types";

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
      project: { select: { name: true, plan: true, deletionPending: true, instanceStatus: true } },
    },
  });
  if (!membership || membership.project.deletionPending) notFound();
  if (!can(membership.role, "pipeline.view")) redirect(homePath(projectId, membership.role));
  const canManage = can(membership.role, "project.manage");
  const allowed = planAllows(membership.project.plan, "broadcast");

  const [broadcasts, usage, optedOut, optedOutTotal] = await Promise.all([
    listBroadcasts(prisma, projectId),
    broadcastUsage(prisma, projectId, membership.project.plan),
    listOptedOut(prisma, { projectId, userId }),
    prisma.contact.count({ where: { projectId, broadcastOptOutAt: { not: null } } }),
  ]);

  const header = (
    <header>
      <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
        Diffusions · {membership.project.name}
      </p>
      <h1 className="mt-1 text-3xl md:text-4xl">Diffusion de messages</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Un même message envoyé à vos clients WhatsApp, personnalisé avec leur prénom. Les réponses
        arrivent dans la messagerie, où l’assistant et votre équipe les traitent comme d’habitude.
      </p>
    </header>
  );

  const upsell = (
    <section className="rounded-2xl border bg-card p-6 sm:p-8">
      <span className="flex size-11 items-center justify-center rounded-xl border bg-muted/50">
        <Megaphone aria-hidden="true" className="size-5" />
      </span>
      <h2 className="mt-4 font-heading text-lg font-semibold tracking-tight">{planUpgradeMessage("broadcast")}</h2>
      <ul className="mt-3 max-w-xl list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
        <li>Pro : 500 contacts par diffusion et 2 000 messages de diffusion par mois.</li>
        <li>Business : 2 000 contacts par diffusion et 10 000 messages de diffusion par mois.</li>
        <li>Ciblage par étiquette, étape du pipeline et activité récente, envoi programmé.</li>
        <li>Suivi des messages distribués, lus et des réponses.</li>
      </ul>
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
  );

  // Without the feature and without history: only the offer is shown.
  if (!allowed && !broadcasts.length) {
    return (
      <main className="mx-auto w-full max-w-5xl space-y-8 p-4 sm:p-6 xl:p-8">
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
    <main className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6 xl:p-8">
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
