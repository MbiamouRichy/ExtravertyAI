import { notFound, redirect } from "next/navigation";
import { after } from "next/server";
import { getSession } from "@/lib/auth-server";
import prisma from "@/lib/prisma";
import { can } from "@/lib/project-permissions";
import { getBillingAccess } from "@/lib/billing-access";
import { needsInitialCheckout } from "@/lib/billing-display";
import { BillingNotice } from "@/components/dashboard/project/billing-notice";
import { ProjectIdentitySync } from "@/components/dashboard/project-identity";
import { projectLogoUrl } from "@/lib/project-logo";
import {
  upgradeWebhookEvents,
  webhookEventsVersion,
} from "@/lib/contact-presence";

export default async function ProjectLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}>) {
  const { projectId } = await params;
  const session = await getSession();
  if (!session?.user?.id) redirect("/sign-in");
  const member = await prisma.projectMembership.findUnique({
    where: { userId_projectId: { userId: session.user.id, projectId } },
    select: {
      role: true,
      project: {
        select: {
          name: true,
          logoKey: true,
          instanceName: true,
          instanceStatus: true,
          webhookEventsVersion: true,
          status: true,
          stripeCustomerId: true,
          stripeSubscriptionId: true,
        },
      },
    },
  });
  if (!member) notFound();
  // Numéro déjà connecté dont le webhook est ancien (événements ou jeton
  // Vercel manquants) : mis à jour une fois, après la réponse.
  const { project } = member;
  if (
    project.instanceStatus === "connected" &&
    project.webhookEventsVersion < webhookEventsVersion()
  )
    after(() =>
      upgradeWebhookEvents(prisma, { id: projectId, ...project }).catch(() =>
        console.error("[webhook] Mise à jour du webhook Evolution reportée."),
      ),
    );
  const access = await getBillingAccess(prisma, projectId);
  return (
    <>
      <ProjectIdentitySync
        projectId={projectId}
        name={member.project.name}
        logoUrl={projectLogoUrl(projectId, member.project.logoKey)}
        role={member.role}
      />
      <BillingNotice
        projectId={projectId}
        initial={access}
        canManageBilling={can(member.role, "billing.manage")}
        canViewBilling={can(member.role, "billing.view")}
        needsCheckout={needsInitialCheckout(member.project)}
      />
      {children}
    </>
  );
}
