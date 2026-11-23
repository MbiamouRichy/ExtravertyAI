import type { Prisma, PrismaClient } from "../src/generated/prisma/client";
import type { AdminIdentity } from "./admin-access";
import { recordAdminAudit } from "./admin-feedback";
import { billingAccess, billingAccessLabel } from "./billing-access";
import { paidMessageLimit } from "./billing-quota";
import {
  MANUAL_PAYMENT_ACTION,
  MANUAL_PERIOD_PREFIX,
  ManualPaymentRecordSchema,
  isRunningManualPeriod,
  planManualPeriod,
  type ManualPaymentInput,
  type ManualPaymentRecord,
} from "./manual-billing-shared";
import { resolvePlanId, type PlanId } from "./pricing";

/** Message sûr à montrer tel quel à l'équipe. */
export class ManualBillingError extends Error {}

const DAY = 86_400_000;
/** Statuts Polar terminés : l'abonnement par carte ne prélèvera plus rien. */
const ENDED_POLAR_STATUSES = ["canceled", "unpaid", "incomplete_expired"];

/**
 * Un abonnement par carte encore vivant (essai, actif, en retard…) : un
 * paiement mobile money le doublerait. Il faut d'abord le révoquer chez Polar.
 */
export function hasLivePolarSubscription(project: {
  stripeSubscriptionId: string | null;
  stripeStatus: string | null;
}) {
  return (
    !!project.stripeSubscriptionId &&
    !ENDED_POLAR_STATUSES.includes(project.stripeStatus ?? "")
  );
}

export type ManualPaymentResult = {
  duplicate: boolean;
  projectName: string;
  plan: PlanId;
  mode: "start" | "extend";
  endsAt: Date;
};

/**
 * Enregistre un paiement reçu hors carte et ouvre (ou prolonge) l'accès du
 * projet, dans une seule transaction, sous le verrou du projet : un double
 * envoi ou deux membres de l'équipe à la fois n'encaissent jamais deux fois.
 */
export async function recordManualPayment(
  db: PrismaClient,
  admin: AdminIdentity,
  input: ManualPaymentInput,
): Promise<ManualPaymentResult> {
  // Lu avant la transaction : une configuration absente n'ouvre rien.
  const monthlyLimit = paidMessageLimit(input.plan);
  return db.$transaction(async (tx) => {
    const [locked] = await tx.$queryRaw<Array<{ id: string; now: Date }>>`
      SELECT id, clock_timestamp() AS now FROM project
      WHERE id = ${input.projectId} FOR UPDATE`;
    if (!locked) throw new ManualBillingError("Ce projet n’existe plus.");
    const now = locked.now;
    const project = await tx.project.findUniqueOrThrow({
      where: { id: input.projectId },
      select: {
        name: true,
        internal: true,
        deletionPending: true,
        automationPaused: true,
        stripeSubscriptionId: true,
        stripeStatus: true,
      },
    });
    if (project.internal)
      throw new ManualBillingError("Le projet interne d’ExtravertyAI n’est jamais facturé.");
    if (project.deletionPending)
      throw new ManualBillingError("Ce projet est en cours de suppression.");

    const duplicate = await tx.adminAuditLog.findFirst({
      where: {
        action: MANUAL_PAYMENT_ACTION,
        targetType: "Project",
        targetId: input.projectId,
        metadata: { path: ["requestId"], equals: input.requestId },
      },
      select: { metadata: true },
    });
    if (duplicate) {
      const record = ManualPaymentRecordSchema.parse(duplicate.metadata);
      return {
        duplicate: true,
        projectName: project.name,
        plan: record.plan,
        mode: record.mode,
        endsAt: new Date(record.endsAt),
      };
    }
    if (hasLivePolarSubscription(project))
      throw new ManualBillingError(
        "Ce projet a un abonnement par carte en cours chez Polar. Révoquez-le dans Polar avant d’enregistrer ce paiement, pour ne pas facturer deux fois.",
      );

    const current = await tx.quotaPeriod.findFirst({
      where: { projectId: input.projectId, isCurrent: true },
      orderBy: { startsAt: "desc" },
    });
    const next = planManualPeriod({ now, current, months: input.months, monthlyLimit });
    let quota;
    if (next.mode === "extend" && current) {
      quota = await tx.quotaPeriod.update({
        where: { id: current.id },
        data: { endsAt: next.endsAt, limit: next.limit },
      });
    } else {
      await tx.quotaPeriod.updateMany({
        where: { projectId: input.projectId, isCurrent: true },
        data: { isCurrent: false },
      });
      quota = await tx.quotaPeriod.create({
        data: {
          projectId: input.projectId,
          key: `${MANUAL_PERIOD_PREFIX}${now.getTime()}`,
          kind: "active",
          startsAt: next.startsAt,
          endsAt: next.endsAt,
          limit: next.limit,
        },
      });
    }
    await tx.project.update({
      where: { id: input.projectId },
      data: {
        // Une automatisation mise en pause par l'équipe du client le reste.
        status: project.automationPaused ? "paused" : "active",
        statusBeforePause: project.automationPaused ? "active" : null,
        plan: input.plan,
        expiredAt: null,
        messageCount: quota.used,
        allMessagesCount: quota.limit,
        // Une synchronisation Polar lue avant ce paiement ne l'écrasera pas.
        billingRevision: { increment: 1 },
      },
    });
    const record: ManualPaymentRecord = {
      requestId: input.requestId,
      plan: input.plan,
      months: input.months,
      amountXaf: input.amountXaf,
      method: input.method,
      reference: input.reference,
      note: input.note,
      mode: next.mode,
      periodId: quota.id,
      endsAt: quota.endsAt.toISOString(),
    };
    await recordAdminAudit(tx, admin, {
      action: MANUAL_PAYMENT_ACTION,
      targetType: "Project",
      targetId: input.projectId,
      metadata: record,
    });
    return {
      duplicate: false,
      projectName: project.name,
      plan: input.plan,
      mode: next.mode,
      endsAt: quota.endsAt,
    };
  });
}

const PROJECT_SELECT = {
  id: true,
  name: true,
  numero: true,
  plan: true,
  status: true,
  automationPaused: true,
  statusBeforePause: true,
  deletionPending: true,
  stripeSubscriptionId: true,
  stripeStatus: true,
  createdAt: true,
  members: {
    where: { role: "OWNER" },
    take: 1,
    select: { user: { select: { email: true } } },
  },
  quotaPeriods: {
    where: { isCurrent: true },
    orderBy: { startsAt: "desc" },
    take: 1,
    select: { key: true, kind: true, startsAt: true, endsAt: true, used: true, limit: true },
  },
} satisfies Prisma.ProjectSelect;
type ProjectRow = Prisma.ProjectGetPayload<{ select: typeof PROJECT_SELECT }>;

function toBillingProject(row: ProjectRow, now: Date) {
  const period = row.quotaPeriods[0] ?? null;
  const access = billingAccess(
    {
      status: row.status,
      automationPaused: row.automationPaused,
      statusBeforePause: row.statusBeforePause,
      deletionPending: row.deletionPending,
      stripeStatus: row.stripeStatus,
      kind: period?.kind ?? null,
      startsAt: period?.startsAt ?? null,
      endsAt: period?.endsAt ?? null,
    },
    now,
  );
  const manual = !!period?.key.startsWith(MANUAL_PERIOD_PREFIX);
  return {
    id: row.id,
    name: row.name,
    numero: row.numero,
    plan: resolvePlanId(row.plan),
    ownerEmail: row.members[0]?.user.email ?? null,
    createdAt: row.createdAt,
    deletionPending: row.deletionPending,
    // Aucun identifiant Polar ne sort du serveur : seulement le fait.
    cardSubscription: hasLivePolarSubscription(row),
    accessAllowed: access.allowed,
    accessLabel: billingAccessLabel(access),
    period: period
      ? {
          manual,
          running: isRunningManualPeriod(period, now),
          endsAt: period.endsAt,
          used: period.used,
          limit: period.limit,
        }
      : null,
  };
}
export type BillingProject = ReturnType<typeof toBillingProject>;

export const PROJECT_SEARCH_MAX = 100;

/** Projets clients (le projet interne est exclu) : les plus récents, ou ceux qui correspondent. */
export async function searchBillingProjects(db: PrismaClient, rawQuery: string, now = new Date()) {
  const query = rawQuery.trim().slice(0, PROJECT_SEARCH_MAX);
  const digits = query.replace(/\D/g, "");
  const where: Prisma.ProjectWhereInput = {
    internal: false,
    ...(query && {
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        {
          members: {
            some: { role: "OWNER", user: { email: { contains: query, mode: "insensitive" } } },
          },
        },
        ...(digits.length >= 4 ? [{ numero: { contains: digits } }] : []),
        ...(/^c[a-z0-9]{20,40}$/.test(query) ? [{ id: query }] : []),
      ],
    }),
  };
  const rows = await db.project.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 20,
    select: PROJECT_SELECT,
  });
  return rows.map((row) => toBillingProject(row, now));
}

/** Périodes mobile money qui finissent sous 7 jours ou ont fini il y a moins de 30 jours. */
export async function listRenewals(db: PrismaClient, now = new Date()) {
  const rows = await db.project.findMany({
    where: {
      internal: false,
      deletionPending: false,
      quotaPeriods: {
        some: {
          isCurrent: true,
          key: { startsWith: MANUAL_PERIOD_PREFIX },
          endsAt: { gt: new Date(now.getTime() - 30 * DAY), lte: new Date(now.getTime() + 7 * DAY) },
        },
      },
    },
    take: 50,
    select: PROJECT_SELECT,
  });
  return rows
    .map((row) => toBillingProject(row, now))
    .sort((a, b) => (a.period?.endsAt.getTime() ?? 0) - (b.period?.endsAt.getTime() ?? 0));
}

export type ManualPaymentRow = ManualPaymentRecord & {
  id: string;
  createdAt: Date;
  projectId: string;
  projectName: string | null;
  actorEmail: string;
};

async function readPayments(
  db: PrismaClient,
  where: Prisma.AdminAuditLogWhereInput,
  take: number,
): Promise<ManualPaymentRow[]> {
  const logs = await db.adminAuditLog.findMany({
    where: { action: MANUAL_PAYMENT_ACTION, targetType: "Project", ...where },
    orderBy: { createdAt: "desc" },
    take,
  });
  const names = new Map(
    (
      await db.project.findMany({
        where: { id: { in: [...new Set(logs.map((log) => log.targetId))] } },
        select: { id: true, name: true },
      })
    ).map((project) => [project.id, project.name]),
  );
  return logs.flatMap((log) => {
    const record = ManualPaymentRecordSchema.safeParse(log.metadata);
    if (!record.success) return [];
    return [
      {
        ...record.data,
        id: log.id,
        createdAt: log.createdAt,
        projectId: log.targetId,
        projectName: names.get(log.targetId) ?? null,
        actorEmail: log.actorEmail,
      },
    ];
  });
}

export function listManualPayments(db: PrismaClient, take = 30) {
  return readPayments(db, {}, take);
}

/**
 * Paiements d'un projet, pour sa page Facturation : date, montant, moyen et
 * durée seulement. La référence et la note restent dans le back-office.
 */
export async function projectManualPayments(db: PrismaClient, projectId: string, take = 24) {
  const rows = await readPayments(db, { targetId: projectId }, take);
  return rows.map(({ id, createdAt, amountXaf, method, months, plan }) => ({
    id,
    createdAt,
    amountXaf,
    method,
    months,
    plan,
  }));
}

/** Encaissé depuis le 1er du mois (UTC) et projets dont l'accès payé hors carte court. */
export async function manualBillingStats(db: PrismaClient, now = new Date()) {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const [payments, running] = await Promise.all([
    readPayments(db, { createdAt: { gte: monthStart } }, 1000),
    db.quotaPeriod.count({
      where: {
        isCurrent: true,
        key: { startsWith: MANUAL_PERIOD_PREFIX },
        startsAt: { lte: now },
        endsAt: { gt: now },
        project: { deletionPending: false, internal: false },
      },
    }),
  ]);
  return {
    monthStart,
    collected: payments.reduce((total, payment) => total + payment.amountXaf, 0),
    paymentCount: payments.length,
    running,
  };
}
