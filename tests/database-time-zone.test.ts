import { test } from "node:test";
import assert from "node:assert/strict";
import { getBillingAccess } from "../lib/billing-access";
import { DATABASE_TIME_ZONE } from "../lib/database-session";
import { createProject, withTestDatabase } from "./helpers/database";

// `@prisma/adapter-pg` remplace le décalage d’un `timestamptz` par `+00:00` sans
// le convertir : hors UTC, l’horloge de la base arriverait décalée. Une heure
// d’avance (UTC+1) ferait expirer l’essai ; cinq heures de retard (UTC-5) le
// feraient commencer plus tard.
for (const serverTimeZone of ["Africa/Libreville", "America/Bogota"]) {
  test(
    `the database clock stays in UTC when the server runs in ${serverTimeZone}`,
    { timeout: 120_000 },
    async () => {
      await withTestDatabase(
        async (prisma) => {
          const [zone] = await prisma.$queryRaw<
            Array<{ session: string; server: string }>
          >`SELECT current_setting('TimeZone') AS session,
              (SELECT reset_val FROM pg_settings WHERE name = 'TimeZone') AS server`;
          assert.deepEqual(zone, {
            session: DATABASE_TIME_ZONE,
            server: serverTimeZone,
          });

          const [{ now }] = await prisma.$queryRaw<
            Array<{ now: Date }>
          >`SELECT clock_timestamp() AS now`;
          assert.ok(Math.abs(now.getTime() - Date.now()) < 60_000);

          const project = await createProject(prisma);
          await prisma.project.update({
            where: { id: project.id },
            data: { status: "trialing" },
          });
          await prisma.quotaPeriod.create({
            data: {
              projectId: project.id,
              key: `trial:${project.id}`,
              kind: "trialing",
              startsAt: new Date(Date.now() - 30 * 60_000),
              endsAt: new Date(Date.now() + 30 * 60_000),
              limit: 100,
            },
          });
          assert.deepEqual(
            await getBillingAccess(prisma, project.id).then(
              ({ allowed, reason }) => ({ allowed, reason }),
            ),
            { allowed: true, reason: "trialing" },
          );
        },
        { serverTimeZone },
      );
    },
  );
}
