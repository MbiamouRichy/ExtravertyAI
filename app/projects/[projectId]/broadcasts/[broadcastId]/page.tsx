import type { Metadata } from "next";
import Link from "next/link";
import { can } from "@/lib/project-permissions";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Target } from "lucide-react";
import { z } from "zod";

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth-server";
import { ACTIVITY_WINDOWS, AudienceSchema, OPT_OUT_FOOTER } from "@/lib/broadcast-shared";
import {
  broadcastStats,
  broadcastTimeline,
  listRecipients,
  listReplies,
  recipientFilterCounts,
} from "@/lib/broadcasts";
import { PIPELINE_STAGES } from "@/lib/pipeline-shared";
import { Button } from "@/components/ui/button";
import { BroadcastLive } from "@/components/dashboard/project/broadcasts/broadcast-live";
import { BroadcastFunnel, BroadcastTimeline } from "@/components/dashboard/project/broadcasts/broadcast-insights";
import {
  BroadcastKpis,
  BroadcastProgress,
  StatusLine,
} from "@/components/dashboard/project/broadcasts/broadcasts-workspace";
import { RecipientsPanel } from "@/components/dashboard/project/broadcasts/recipients-panel";
import { RepliesPanel } from "@/components/dashboard/project/broadcasts/replies-panel";
import { SectionTabs } from "@/components/dashboard/project/broadcasts/section-tabs";
import type { BroadcastView } from "@/components/dashboard/project/broadcasts/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Diffusion | ExtravertyAI",
  robots: { index: false, follow: false },
};

const dateTime = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });
const Id = z.string().cuid();

export default async function BroadcastPage({
  params,
}: {
  params: Promise<{ projectId: string; broadcastId: string }>;
}) {
  const { projectId, broadcastId } = await params;
  // Malformed identifiers never reach the database.
  if (!Id.safeParse(projectId).success || !Id.safeParse(broadcastId).success) notFound();
  const base = `/projects/${projectId}/broadcasts`;
  const session = await getSession();
  if (!session?.user?.id) redirect(`/sign-in?callbackUrl=${encodeURIComponent(`${base}/${broadcastId}`)}`);
  const userId = session.user.id;
  const membership = await prisma.projectMembership.findUnique({
    where: { userId_projectId: { userId, projectId } },
    select: { role: true, project: { select: { deletionPending: true } } },
  });
  // A broadcast of another project, or no access: the same « not found ».
  if (
    !membership ||
    membership.project.deletionPending ||
    !can(membership.role, "pipeline.view")
  )
    notFound();
  const broadcast = await prisma.broadcast.findFirst({
    where: { id: broadcastId, projectId },
    include: { createdBy: { select: { name: true } } },
  });
  if (!broadcast) notFound();
  const canManage = can(membership.role, "project.manage");

  const [stats, counts, recipients, replies, timeline] = await Promise.all([
    broadcastStats(prisma, [broadcast.id]),
    recipientFilterCounts(prisma, broadcast.id),
    listRecipients(prisma, { projectId, userId, broadcastId, filter: "all" }),
    listReplies(prisma, { projectId, userId, broadcastId }),
    broadcastTimeline(prisma, broadcast.id),
  ]);
  const audience = AudienceSchema.safeParse(broadcast.audience);
  const tagNames =
    audience.success && audience.data.tagIds.length
      ? (
          await prisma.tag.findMany({
            where: { projectId, id: { in: audience.data.tagIds } },
            select: { name: true },
          })
        ).map((tag) => tag.name)
      : [];

  const view: BroadcastView = {
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
    stats: stats.get(broadcast.id) ?? null,
  };
  const criteria = [
    tagNames.length ? `Étiquettes : ${tagNames.join(", ")}` : "Toutes les étiquettes",
    audience.success && audience.data.stages.length
      ? `Étapes : ${audience.data.stages
          .map((id) => PIPELINE_STAGES.find((stage) => stage.id === id)?.label ?? id)
          .join(", ")}`
      : "Toutes les étapes du pipeline",
    audience.success && audience.data.activeWithinDays
      ? `Dernier message : ${ACTIVITY_WINDOWS.find((window) => window.days === audience.data.activeWithinDays)?.label.toLowerCase()}`
      : "Sans condition d’ancienneté",
    "Désinscrits (STOP) toujours exclus",
  ];
  // The variable stays visible as typed: each contact receives their own first name.
  const parts = broadcast.content.split(/(\{\s*pr[ée]nom\s*\})/iu);

  const overview = (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-6">
        <BroadcastFunnel stats={view.stats} targeted={broadcast.recipientCount} />
        <section aria-labelledby="broadcast-targeting" className="rounded-2xl border bg-card p-4 sm:p-6">
          <h2 id="broadcast-targeting" className="flex items-center gap-2 text-sm font-semibold">
            <Target aria-hidden="true" className="size-4" />
            Ciblage
          </h2>
          <ul className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
            {criteria.map((line) => (
              <li key={line} className="rounded-lg border px-3 py-2">
                {line}
              </li>
            ))}
          </ul>
        </section>
      </div>
      <div className="space-y-6">
        <section aria-labelledby="broadcast-message" className="rounded-2xl border bg-muted/40 p-4">
          <h2 id="broadcast-message" className="font-mono text-[10px] font-normal uppercase tracking-wider text-muted-foreground">
            Message envoyé
          </h2>
          <div className="mt-3 ml-auto max-w-[92%] overflow-hidden rounded-2xl rounded-tr-sm bg-card shadow-sm">
            {broadcast.mediaUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- private image behind a membership check
              <img
                src={`/api/projects/${projectId}/broadcasts/${broadcast.id}/media`}
                alt="Image jointe à la diffusion"
                loading="lazy"
                decoding="async"
                className="max-h-64 w-full bg-muted object-cover"
              />
            )}
            <p className="whitespace-pre-wrap wrap-anywhere px-3 py-2 text-sm leading-relaxed">
              {parts.map((part, index) =>
                index % 2 ? (
                  <mark key={index} className="rounded bg-primary/10 px-0.5 text-foreground">
                    {part}
                  </mark>
                ) : (
                  part
                ),
              )}
              {"\n\n"}
              <em className="text-muted-foreground">{OPT_OUT_FOOTER}</em>
            </p>
          </div>
          {broadcast.nameFallback && (
            <p className="mt-2 text-xs text-muted-foreground">Sans prénom connu : « {broadcast.nameFallback} ».</p>
          )}
        </section>
        <BroadcastTimeline events={timeline} />
      </div>
    </div>
  );

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6 xl:p-8">
      <header className="space-y-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={base}>
            <ArrowLeft data-icon="inline-start" />
            Diffusions
          </Link>
        </Button>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Diffusion</p>
            <h1 className="mt-1 text-3xl wrap-anywhere md:text-4xl">{broadcast.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Créée le {dateTime.format(broadcast.createdAt)}
              {view.author ? ` par ${view.author}` : ""}
              {broadcast.startedAt ? ` · partie le ${dateTime.format(broadcast.startedAt)}` : ""}
              {broadcast.finishedAt ? ` · terminée le ${dateTime.format(broadcast.finishedAt)}` : ""}
            </p>
          </div>
          <div className="flex flex-col items-start gap-3 sm:items-end">
            <StatusLine broadcast={view} />
            <BroadcastLive
              projectId={projectId}
              broadcastId={broadcast.id}
              name={broadcast.name}
              status={broadcast.status}
              pending={view.stats?.pending ?? 0}
              canManage={canManage}
            />
          </div>
        </div>
        <BroadcastProgress broadcast={view} />
        <BroadcastKpis broadcast={view} size="lg" />
      </header>

      <SectionTabs
        label="Sections de la diffusion"
        tabs={[
          { id: "apercu", label: "Vue d’ensemble", content: overview },
          {
            id: "destinataires",
            label: "Destinataires",
            count: counts.all,
            content: (
              <RecipientsPanel projectId={projectId} broadcastId={broadcast.id} counts={counts} initial={recipients} />
            ),
          },
          {
            id: "reponses",
            label: "Réponses",
            count: counts.replied,
            content: <RepliesPanel projectId={projectId} broadcastId={broadcast.id} initial={replies} />,
          },
        ]}
      />
    </main>
  );
}
