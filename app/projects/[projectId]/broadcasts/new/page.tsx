import type { Metadata } from "next";
import Link from "next/link";
import { can } from "@/lib/project-permissions";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth-server";
import { broadcastUsage } from "@/lib/broadcasts";
import { planAllows } from "@/lib/plan-features";
import { Button } from "@/components/ui/button";
import { BroadcastComposer } from "@/components/dashboard/project/broadcasts/broadcast-composer";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Nouvelle diffusion | ExtravertyAI",
  robots: { index: false, follow: false },
};

export default async function NewBroadcastPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  if (!z.string().cuid().safeParse(projectId).success) notFound();
  const base = `/projects/${projectId}/broadcasts`;
  const session = await getSession();
  if (!session?.user?.id) redirect(`/sign-in?callbackUrl=${encodeURIComponent(`${base}/new`)}`);
  const membership = await prisma.projectMembership.findUnique({
    where: { userId_projectId: { userId: session.user.id, projectId } },
    select: {
      role: true,
      project: { select: { name: true, plan: true, deletionPending: true, instanceStatus: true } },
    },
  });
  if (!membership || membership.project.deletionPending) notFound();
  // Creation is reserved to owners and administrators, on plans with broadcasts.
  if (!can(membership.role, "project.manage") || !planAllows(membership.project.plan, "broadcast")) {
    redirect(base);
  }
  const active = await prisma.broadcast.findFirst({
    where: { projectId, status: { in: ["SCHEDULED", "SENDING", "PAUSED"] } },
    select: { id: true, name: true },
  });

  const [tags, usage] = await Promise.all([
    prisma.tag.findMany({
      where: { projectId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
      take: 100,
    }),
    broadcastUsage(prisma, projectId, membership.project.plan),
  ]);

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6 xl:p-8">
      <header>
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={base}>
            <ArrowLeft data-icon="inline-start" />
            Diffusions
          </Link>
        </Button>
        <h1 className="mt-2 text-3xl md:text-4xl">Nouvelle diffusion</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Rédigez votre message, choisissez qui le reçoit, puis lancez-le maintenant ou programmez-le.
        </p>
      </header>
      {active ? (
        <section className="rounded-2xl border bg-card p-6">
          <h2 className="font-heading text-lg font-semibold tracking-tight">Une diffusion est déjà en cours</h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            « {active.name} » n’est pas terminée. Une seule diffusion à la fois protège votre numéro WhatsApp :
            attendez sa fin ou annulez-la pour en créer une nouvelle.
          </p>
          <Button asChild className="mt-4" variant="outline">
            <Link href={`${base}/${active.id}`}>Voir la diffusion en cours</Link>
          </Button>
        </section>
      ) : (
        <BroadcastComposer
          projectId={projectId}
          tags={tags}
          usage={usage}
          connected={membership.project.instanceStatus === "connected"}
        />
      )}
    </main>
  );
}
