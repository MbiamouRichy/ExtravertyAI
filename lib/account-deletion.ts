import prisma from "./prisma";

export type AccountDeletionPlan = {
  /** Owned projects shared with other members and no other owner: must be transferred first. */
  blockers: { id: string; name: string; members: number }[];
  /** Projects the account solely owns and that will be deleted with it. */
  deleted: { id: string; name: string }[];
  /** Projects where only the membership is removed (member, admin or co-owner). */
  left: number;
};

// Single source of truth for the account deletion UI, the auth hooks and the
// confirmation email, so what the user is shown is what the server deletes.
export async function getAccountDeletionPlan(
  userId: string,
): Promise<AccountDeletionPlan> {
  const memberships = await prisma.projectMembership.findMany({
    where: { userId },
    select: {
      role: true,
      project: {
        select: {
          id: true,
          name: true,
          members: { where: { userId: { not: userId } }, select: { role: true } },
        },
      },
    },
  });
  const plan: AccountDeletionPlan = { blockers: [], deleted: [], left: 0 };
  for (const { role, project } of memberships) {
    const others = project.members;
    if (role !== "OWNER" || others.some((m) => m.role === "OWNER")) plan.left++;
    else if (others.length)
      plan.blockers.push({ id: project.id, name: project.name, members: others.length });
    else plan.deleted.push({ id: project.id, name: project.name });
  }
  return plan;
}
