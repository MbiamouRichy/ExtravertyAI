-- Rôles d'équipe : USER devient AGENT (mêmes droits), plus SUPERVISOR, VIEWER
-- (lecteur-analyste) et BILLING (facturation). Droits : lib/project-permissions.ts.

-- Le rôle global du compte avait le même type : il garde ses valeurs dans un type à part.
CREATE TYPE "GlobalRole" AS ENUM ('USER', 'ADMIN', 'OWNER');
ALTER TABLE "user" ALTER COLUMN "globalRole" DROP DEFAULT;
ALTER TABLE "user" ALTER COLUMN "globalRole" TYPE "GlobalRole" USING ("globalRole"::text::"GlobalRole");
ALTER TABLE "user" ALTER COLUMN "globalRole" SET DEFAULT 'USER';

-- Renommer conserve chaque membre et chaque invitation en attente : aucun droit ne change.
ALTER TYPE "Role" RENAME VALUE 'USER' TO 'AGENT';

-- Ordre du type, du plus restreint au plus large : BILLING, VIEWER, AGENT,
-- SUPERVISOR, ADMIN, OWNER (les listes triées « desc » montrent le propriétaire d'abord).
-- Aucune requête de cette migration n'emploie ces nouvelles valeurs (PostgreSQL l'interdit
-- dans la transaction qui les crée).
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SUPERVISOR' BEFORE 'ADMIN';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'VIEWER' BEFORE 'AGENT';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'BILLING' BEFORE 'VIEWER';

ALTER TABLE "invitation" ALTER COLUMN "role" SET DEFAULT 'AGENT';

-- Répartition automatique : seuls les rôles qui traitent les conversations
-- (administrateur, superviseur, agent) en reçoivent ; jamais le propriétaire,
-- un lecteur ni la facturation. Comparaison en texte : les nouvelles valeurs ne
-- sont lues qu'à l'exécution du déclencheur, après cette migration.
CREATE OR REPLACE FUNCTION contact_auto_assign_single_member() RETURNS trigger AS $$
DECLARE
  chosen TEXT;
  enabled BOOLEAN;
BEGIN
  IF NEW."assigneeId" IS NULL THEN
    SELECT p."autoAssignTeam" INTO enabled
    FROM project p
    WHERE p.id = NEW."projectId" AND p.plan = 'business';
    IF FOUND THEN
      SELECT min(pm."userId") INTO chosen
      FROM project_membership pm
      WHERE pm."projectId" = NEW."projectId"
      HAVING count(*) = 1;

      IF chosen IS NULL AND enabled THEN
        SELECT pm."userId" INTO chosen
        FROM project_membership pm
        WHERE pm."projectId" = NEW."projectId"
          AND pm.role::text IN ('ADMIN', 'SUPERVISOR', 'AGENT')
          AND EXISTS (
            SELECT 1 FROM user_presence up
            WHERE up."userId" = pm."userId"
              AND up."lastSeenAt" > NOW() - INTERVAL '90 seconds'
              AND up."lastActiveAt" > NOW() - INTERVAL '5 minutes'
          )
        ORDER BY
          (SELECT count(*) FROM contact c
            WHERE c."projectId" = NEW."projectId" AND c."assigneeId" = pm."userId"
              AND c."resolvedAt" IS NULL),
          (SELECT max(c."assignedAt") FROM contact c
            WHERE c."projectId" = NEW."projectId" AND c."assigneeId" = pm."userId") ASC NULLS FIRST,
          pm."userId"
        LIMIT 1;
      END IF;

      IF chosen IS NOT NULL THEN
        NEW."assigneeId" := chosen;
        NEW."assignedAt" := COALESCE(NEW."assignedAt", now() AT TIME ZONE 'UTC');
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;
