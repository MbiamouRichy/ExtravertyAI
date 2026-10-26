import "dotenv/config";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { workerDatabase } from "../workers/shared";

const Schema = z.array(
  z.object({
    projectId: z.string().min(1),
    key: z.string().regex(/^(trial:|cycle:)/),
    kind: z.enum(["active", "trialing"]),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    limit: z.number().int().nonnegative(),
    expectedUsed: z.number().int().nonnegative(),
  }),
);
async function main() {
  const path = process.argv[2];
  if (!path)
    throw new Error(
      "Usage: tsx scripts/bootstrap-quotas.ts manifest.json [--apply]",
    );
  const rows = Schema.parse(JSON.parse(await readFile(path, "utf8")));
  if (new Set(rows.map((r) => r.projectId)).size !== rows.length)
    throw new Error("Duplicate project");
  const prisma = workerDatabase();
  try {
    await prisma.$transaction(
      async (tx) => {
        for (const row of [...rows].sort((a, b) =>
          a.projectId.localeCompare(b.projectId),
        )) {
          await tx.$queryRaw`SELECT id FROM project WHERE id = ${row.projectId} FOR UPDATE`;
          const p = await tx.project.findUniqueOrThrow({
            where: { id: row.projectId },
          });
          if (
            p.status !== row.kind ||
            p.messageCount !== row.expectedUsed ||
            !p.stripeSubscriptionId ||
            row.endsAt <= row.startsAt ||
            row.endsAt <= new Date() ||
            row.startsAt > new Date()
          )
            throw new Error(`Invalid period/counter: ${row.projectId}`);
          const expectedKey =
            row.kind === "trialing"
              ? `trial:${p.stripeSubscriptionId}`
              : `cycle:${p.stripeSubscriptionId}:${Math.floor(row.startsAt.getTime() / 1000)}`;
          if (
            row.key !== expectedKey ||
            (row.kind === "trialing" && row.limit !== 150)
          )
            throw new Error("Invalid canonical billing key/limit");
          const current = await tx.quotaPeriod.findFirst({
            where: { projectId: row.projectId, isCurrent: true },
          });
          if (current) {
            if (
              current.key !== row.key ||
              current.used !== row.expectedUsed ||
              current.limit !== row.limit ||
              +current.startsAt !== +row.startsAt ||
              +current.endsAt !== +row.endsAt
            )
              throw new Error("Existing period differs; reconcile manually");
            continue;
          }
          if (process.argv.includes("--apply")) {
            await tx.quotaPeriod.create({
              data: {
                projectId: row.projectId,
                key: row.key,
                kind: row.kind,
                startsAt: row.startsAt,
                endsAt: row.endsAt,
                limit: row.limit,
                used: row.expectedUsed,
              },
            });
            await tx.project.update({
              where: { id: row.projectId },
              data: { allMessagesCount: row.limit },
            });
          }
        }
      },
      { timeout: 30000 },
    );
    console.log(
      `${rows.length} période(s) ${process.argv.includes("--apply") ? "initialisées" : "validées (simulation)"}.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Bootstrap failed");
  process.exitCode = 1;
});
