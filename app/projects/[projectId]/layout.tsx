import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth-server";
import prisma from "@/lib/prisma";
import { getBillingAccess } from "@/lib/billing-access";
import { BillingNotice } from "@/components/dashboard/project/billing-notice";

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
    select: { role: true },
  });
  if (!member) notFound();
  const access = await getBillingAccess(prisma, projectId);
  return (
    <>
      <BillingNotice
        projectId={projectId}
        initial={access}
        canViewBilling={["OWNER", "ADMIN"].includes(member.role)}
      />
      {children}
    </>
  );
}
