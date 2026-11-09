import { PGlite } from "@electric-sql/pglite";
import { DATABASE_TIME_ZONE } from "../../lib/database-session";

/**
 * PGlite démarre dans le fuseau de la machine (`Etc/GMT-1` au Gabon) et ignore
 * l’option de démarrage par laquelle l’application met chaque session en UTC.
 * Sa session unique, que partagent toutes les connexions du socket, reçoit donc
 * ce fuseau dès sa création. `serverTimeZone` règle le serveur ailleurs, pour
 * vérifier que l’horloge lue par l’application n’en dépend pas.
 */
export async function createTestPGlite({
  serverTimeZone,
}: { serverTimeZone?: string } = {}) {
  const db = await PGlite.create(
    serverTimeZone
      ? {
          startParams: [
            ...PGlite.defaultStartParams,
            "-c",
            `TimeZone=${serverTimeZone}`,
          ],
        }
      : undefined,
  );
  await db.exec(`SET TimeZone TO '${DATABASE_TIME_ZONE}'`);
  return db;
}
