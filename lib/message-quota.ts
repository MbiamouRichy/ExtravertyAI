import type { Prisma } from "../src/generated/prisma/client";
import { extraMessageCost } from "./message-credit";

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
// Au-delà du quota d’une période payée, le message est prélevé sur le crédit
// prépayé du projet, au prix de son offre, jusqu’à `limit` messages de plus.
export async function reserveMessageQuota(
  tx: Prisma.TransactionClient,
  projectId: string,
) {
  const [project] = await tx.$queryRaw<
    Array<{
      status: string;
      deletionPending: boolean;
      plan: string;
      extraCredit: number;
      now: Date;
    }>
  >`
    SELECT (CASE WHEN "automationPaused" AND status = 'paused' THEN COALESCE("statusBeforePause", status) ELSE status END)::text AS status, "deletionPending", plan::text AS plan, "extraCredit", clock_timestamp() AS now FROM project
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
      "Votre période d’accès est terminée ou attend une confirmation de paiement. Consultez la facturation pour reprendre les envois.",
    );
  const updated = await tx.quotaPeriod.updateMany({
    where: { id: period.id, used: { lt: period.limit } },
    data: { used: { increment: 1 } },
  });
  if (updated.count === 1) {
    await tx.project.update({
      where: { id: projectId },
      data: { messageCount: period.used + 1 + period.extraUsed },
    });
    return {
      quotaPeriodId: period.id,
      used: period.used + 1,
      limit: period.limit,
      extra: false,
    };
  }
  // Le projet est verrouillé : crédit et compteur lus ici restent exacts.
  // Les conditions sont répétées dans les écritures, par prudence.
  const cost = extraMessageCost(project.plan);
  if (period.kind === "active" && project.extraCredit >= cost) {
    const extra = await tx.quotaPeriod.updateMany({
      where: { id: period.id, used: { gte: period.limit }, extraUsed: { lt: period.limit } },
      data: { extraUsed: { increment: 1 } },
    });
    const paid =
      extra.count === 1 &&
      (
        await tx.project.updateMany({
          where: { id: projectId, extraCredit: { gte: cost } },
          data: {
            extraCredit: { decrement: cost },
            messageCount: period.used + period.extraUsed + 1,
          },
        })
      ).count === 1;
    if (paid)
      return {
        quotaPeriodId: period.id,
        used: period.used,
        limit: period.limit,
        extra: true,
      };
    // Impossible sous le verrou ; l’appelant annule toute la transaction.
    if (extra.count === 1) throw new Error("EXTRA_CREDIT_CONFLICT");
  }
  throw new MessageQuotaError(
    "QUOTA_EXCEEDED",
    period.kind !== "active"
      ? "Le quota de messages est atteint."
      : period.extraUsed >= period.limit
        ? "Le quota de messages et le plafond de messages supplémentaires sont atteints pour cette période."
        : "Le quota de messages est atteint. Achetez des messages supplémentaires depuis la page Facturation.",
  );
}
