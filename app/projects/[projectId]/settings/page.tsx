import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import ProjectSettingsPage from "@/components/dashboard/project/projectSettingsPage";
import { getSession } from "@/lib/auth-server";
import prisma from "@/lib/prisma";
import { AGENT_DEFAULTS, type AgentConfig } from "@/lib/agent-config";
import type { ProjectSettingsView } from "@/lib/settings-types";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Paramètres du projet | ExtravertyAI",
  robots: { index: false, follow: false },
};
export default async function SettingsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const session = await getSession();
  if (!session?.user?.id)
    redirect(
      `/sign-in?callbackUrl=${encodeURIComponent(`/projects/${projectId}/settings`)}`,
    );
  const membership = await prisma.projectMembership.findUnique({
    where: { userId_projectId: { userId: session.user.id, projectId } },
    include: { project: true },
  });
  if (!membership) notFound();
  if (!["OWNER", "ADMIN"].includes(membership.role))
    redirect(`/projects/${projectId}/chat`);
  const p = membership.project;
  const [stats, audit, period] = await Promise.all([
    prisma.$queryRaw<Array<{ week: number; month: number; year: number }>>`
      SELECT count(*) FILTER (WHERE "createdAt" >= CURRENT_TIMESTAMP - interval '7 days')::int AS week,
        count(*) FILTER (WHERE "createdAt" >= CURRENT_TIMESTAMP - interval '30 days')::int AS month,
        count(*)::int AS year
      FROM message WHERE "projectId" = ${projectId} AND "fromMe" = true
        AND status IN ('SENT', 'DELIVERED', 'READ')
        AND "createdAt" >= CURRENT_TIMESTAMP - interval '365 days'
    `,
    prisma.settingsAudit.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, action: true, createdAt: true },
    }),
    prisma.quotaPeriod.findFirst({ where: { projectId, isCurrent: true } }),
  ]);
  // Explicit safe projection: no provider token, subscription ID or other server secret is serialized.
  const view: ProjectSettingsView = {
    id: p.id,
    name: p.name,
    numero: p.numero,
    role: membership.role,
    plan: p.plan,
    status: p.status,
    instanceStatus: p.instanceStatus,
    messageCount: period?.used ?? p.messageCount,
    allMessagesCount: period?.limit ?? p.allMessagesCount,
    periodEnd:
      (period?.endsAt ?? p.stripeCurrentPeriodEnd)?.toISOString() ?? null,
    config: Object.fromEntries(
      Object.keys(AGENT_DEFAULTS).map((key) => [
        key,
        p[key as keyof typeof AGENT_DEFAULTS],
      ]),
    ) as AgentConfig,
    agentConfigVersion: p.agentConfigVersion,
    setupComplete: !!p.agentSetupCompletedAt,
    automationPaused: p.automationPaused,
    settingsVersion: p.settingsVersion,
    deletionPending: p.deletionPending,
    whatsapp: {
      alwaysOnline: p.whatsappAlwaysOnline,
      readMessages: p.whatsappReadMessages,
      typing: p.whatsappTyping,
      pending: p.whatsappSettingsPending,
      error: p.whatsappSettingsError,
    },
    stats: stats[0],
    audit: audit.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
    })),
  };
  return <ProjectSettingsPage project={view} />;
}
