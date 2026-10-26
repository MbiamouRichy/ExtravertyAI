import { randomUUID } from "node:crypto";
import type {
  Prisma,
  PrismaClient,
  ReportEmail,
} from "../src/generated/prisma/client";
import { getBillingAccess } from "./billing-access";
import { collectWeekAggregate } from "./report-aggregates";
import { buildFindings, buildVerdict } from "./report-findings";
import { readIndicators } from "./report-indicators";
import type { WeekAggregate } from "./report-week";
import { can, rolesWith } from "./project-permissions";
import {
  reportEmail,
  reportRange,
  reportWindow,
  WEEK_MS,
  type ReportMetrics,
  type ReportSnapshotV2,
} from "./weekly-report";

/** Semaines comparées : 8 pour la plage normale, plus 12 pour les courbes. */
const SERIES_WEEKS = 20;

export async function collectReportMetrics(
  db: Prisma.TransactionClient,
  projectId: string,
  start: Date,
  end: Date,
): Promise<ReportMetrics> {
  const [counts] = await db.$queryRaw<ReportMetrics[]>`
    SELECT COUNT(*) FILTER (WHERE "senderType" = 'CLIENT' AND NOT "fromMe")::int AS received,
      COUNT(*) FILTER (WHERE "fromMe" AND status IN ('SENT', 'DELIVERED', 'READ'))::int AS sent,
      COUNT(*) FILTER (WHERE "fromMe" AND "senderType" = 'BOT' AND status IN ('SENT', 'DELIVERED', 'READ'))::int AS "aiSent",
      COUNT(*) FILTER (WHERE "fromMe" AND status = 'FAILED')::int AS failed,
      COUNT(DISTINCT "contactId")::int AS "activeContacts"
    FROM message WHERE "projectId" = ${projectId} AND "createdAt" >= ${start} AND "createdAt" < ${end}`;
  const newContacts = await db.contact.count({
    where: { projectId, createdAt: { gte: start, lt: end } },
  });
  const changes = await db.settingsAudit.count({
    where: {
      projectId,
      action: "agent.updated",
      createdAt: { gte: start, lt: end },
    },
  });
  const csatResponses = await db.csatSurvey.count({
    where: { projectId, respondedAt: { gte: start, lt: end } },
  });
  return { ...counts, newContacts, changes, csatResponses };
}

export async function queueNextWeeklyReport(
  db: PrismaClient,
  config: { from: string; origin: string },
) {
  return db.$transaction(
    async (tx) => {
      const [candidate] = await tx.$queryRaw<{ id: string; now: Date }[]>`
      SELECT id, clock_timestamp() AS now FROM project
      WHERE "reportsCheckAt" <= clock_timestamp()
      ORDER BY "reportsCheckAt", id LIMIT 1 FOR UPDATE SKIP LOCKED`;
      if (!candidate) return false;
      const project = await tx.project.findUniqueOrThrow({
        where: { id: candidate.id },
      });
      const { now } = candidate;
      // Recheck ineligible projects daily so renewed/upgraded subscriptions resume.
      await tx.project.update({
        where: { id: project.id },
        data: { reportsCheckAt: new Date(now.getTime() + 86400000) },
      });
      if (
        project.plan !== "business" ||
        !project.reportsEnabled ||
        project.deletionPending ||
        !(await getBillingAccess(tx, project.id)).allowed
      )
        return true;
      const window = reportWindow(now, project.reportsHourUtc);
      await tx.project.update({
        where: { id: project.id },
        data: { reportsCheckAt: window.next },
      });
      if (now < window.due || project.createdAt >= window.end) return true;
      if (
        await tx.weeklyReport.findUnique({
          where: {
            projectId_weekStart: {
              projectId: project.id,
              weekStart: window.start,
            },
          },
        })
      )
        return true;
      // Les semaines antérieures à la création du projet sont exclues de la série.
      const firstWeek = Math.max(
        window.start.getTime() - (SERIES_WEEKS - 1) * WEEK_MS,
        reportWindow(project.createdAt, 0).end.getTime(),
      );
      const weeks: WeekAggregate[] = [];
      for (
        let time = firstWeek;
        time <= window.start.getTime();
        time += WEEK_MS
      ) {
        const start = new Date(time);
        const end = new Date(time + WEEK_MS);
        const legacy = await collectReportMetrics(tx, project.id, start, end);
        weeks.push(
          await collectWeekAggregate(tx, project.id, start, end, legacy),
        );
      }
      const week = weeks[weeks.length - 1];
      const current = week.legacy;
      const readings = readIndicators(weeks, weeks.length - 1);
      const snapshot: ReportSnapshotV2 = {
        version: 2,
        weeks,
        partial: project.createdAt > window.start,
        verdict: buildVerdict(readings, week),
        // Chemins relatifs au projet : page et e-mail reconstruisent le lien.
        findings: buildFindings(
          readings,
          week,
          reportRange(window.start, window.end),
          "",
        ),
      };
      const skipped =
        project.reportsSkipEmpty &&
        current.activeContacts === 0 &&
        current.newContacts === 0 &&
        current.changes === 0;
      const report = await tx.weeklyReport.create({
        data: {
          projectId: project.id,
          weekStart: window.start,
          weekEnd: window.end,
          // Les dates deviennent des chaînes ISO, relues par ReportSnapshotSchema.
          snapshot: snapshot as unknown as Prisma.InputJsonObject,
          skipped,
        },
      });
      if (skipped) return true;
      const recipients = await tx.projectMembership.findMany({
        where: {
          projectId: project.id,
          role: { in: rolesWith("stats.view") },
          user: { emailVerified: true },
        },
        select: { userId: true, user: { select: { email: true } } },
      });
      const payload = reportEmail(
        project.name,
        snapshot,
        window.start,
        window.end,
        `${config.origin}/projects/${encodeURIComponent(project.id)}/reports?report=${report.id}`,
        project.reportsIncludeTips,
      );
      await tx.reportEmail.createMany({
        data: recipients.map((member) => ({
          reportId: report.id,
          recipientId: member.userId,
          recipient: member.user.email,
          from: config.from,
          ...payload,
        })),
      });
      return true;
    },
    { timeout: 30000, isolationLevel: "RepeatableRead" },
  );
}

export async function deliverNextReportEmail(
  db: PrismaClient,
  send: (email: ReportEmail) => Promise<string>,
) {
  const token = randomUUID();
  const email = await db.$transaction(async (tx) => {
    // Provider idempotency lasts 24h. An uncertain send must never be retried outside it.
    const review =
      await tx.$executeRaw`UPDATE report_email SET state = 'REVIEW_REQUIRED', "leaseToken" = NULL, "leaseUntil" = NULL
      WHERE state IN ('PENDING', 'SENDING') AND "firstAttemptAt" < clock_timestamp() - interval '23 hours'
      AND ("leaseUntil" IS NULL OR "leaseUntil" <= clock_timestamp())`;
    if (review)
      console.error("[reports-worker] Envois à vérifier.", { count: review });
    const [candidate] = await tx.$queryRaw<{ id: string; now: Date }[]>`
      SELECT id, clock_timestamp() AS now FROM report_email
      WHERE (state = 'PENDING' AND "availableAt" <= clock_timestamp()) OR (state = 'SENDING' AND "leaseUntil" <= clock_timestamp())
      ORDER BY "availableAt", id LIMIT 1 FOR UPDATE SKIP LOCKED`;
    if (!candidate) return null;
    const record = await tx.reportEmail.findUniqueOrThrow({
      where: { id: candidate.id },
      include: { report: { include: { project: true } } },
    });
    const { project } = record.report;
    const member = await tx.projectMembership.findUnique({
      where: {
        userId_projectId: { userId: record.recipientId, projectId: project.id },
      },
      include: { user: { select: { email: true, emailVerified: true } } },
    });
    const relevant =
      member &&
      can(member.role, "stats.view") &&
      member.user.emailVerified &&
      member.user.email === record.recipient &&
      project.plan === "business" &&
      project.reportsEnabled &&
      !project.deletionPending &&
      record.report.weekEnd.getTime() > candidate.now.getTime() - WEEK_MS &&
      (await getBillingAccess(tx, project.id)).allowed;
    if (!relevant) {
      await tx.reportEmail.update({
        where: { id: record.id },
        data: { state: "CANCELLED", leaseToken: null, leaseUntil: null },
      });
      return { cancelled: true as const };
    }
    return tx.reportEmail.update({
      where: { id: record.id },
      data: {
        state: "SENDING",
        leaseToken: token,
        leaseUntil: new Date(candidate.now.getTime() + 120000),
        firstAttemptAt: record.firstAttemptAt ?? candidate.now,
        attempts: { increment: 1 },
      },
    });
  });
  if (!email) return false;
  if ("cancelled" in email) return true;
  try {
    const providerId = await send(email);
    await db.reportEmail.updateMany({
      where: { id: email.id, state: "SENDING", leaseToken: token },
      data: {
        state: "SENT",
        providerId,
        sentAt: new Date(),
        leaseToken: null,
        leaseUntil: null,
      },
    });
  } catch {
    await db.$executeRaw`UPDATE report_email SET state = 'PENDING', "leaseToken" = NULL, "leaseUntil" = NULL,
      "availableAt" = clock_timestamp() + (${Math.min(3600, 30 * 2 ** Math.min(email.attempts, 7))} * interval '1 second')
      WHERE id = ${email.id} AND state = 'SENDING' AND "leaseToken" = ${token}`;
    console.error("[reports-worker] Envoi à réessayer.", { emailId: email.id });
  }
  return true;
}
