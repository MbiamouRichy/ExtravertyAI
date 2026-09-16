import type { Prisma } from "../src/generated/prisma/client";

export class MessageQuotaError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "MessageQuotaError";
  }
}

// Must share the transaction that deduplicates and creates Message + OutboundJob.
export async function reserveMessageQuota(
  tx: Prisma.TransactionClient,
  projectId: string,
) {
  const [project] = await tx.$queryRaw<
    Array<{ status: string; deletionPending: boolean; now: Date }>
  >`
    SELECT status::text, "deletionPending", clock_timestamp() AS now FROM project
    WHERE id = ${projectId} FOR UPDATE
  `;
  if (
    !project ||
    project.deletionPending ||
    !["active", "trialing"].includes(project.status)
  ) {
    throw new MessageQuotaError(
      "PROJECT_INACTIVE",
      "Le projet n’est pas actif.",
    );
  }
  const period = await tx.quotaPeriod.findFirst({
    where: {
      projectId,
      isCurrent: true,
      kind: project.status as "active" | "trialing",
      startsAt: { lte: project.now },
      endsAt: { gt: project.now },
    },
  });
  if (!period)
    throw new MessageQuotaError(
      "PERIOD_UNAVAILABLE",
      "La période de quota est indisponible ou expirée.",
    );
  const updated = await tx.quotaPeriod.updateMany({
    where: { id: period.id, used: { lt: period.limit } },
    data: { used: { increment: 1 } },
  });
  if (updated.count !== 1)
    throw new MessageQuotaError(
      "QUOTA_EXCEEDED",
      "Le quota de messages est atteint.",
    );
  await tx.project.update({
    where: { id: projectId },
    data: { messageCount: period.used + 1 },
  });
  return {
    quotaPeriodId: period.id,
    used: period.used + 1,
    limit: period.limit,
  };
}
