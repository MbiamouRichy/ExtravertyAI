-- Offre Business : répartition automatique des nouvelles conversations.
ALTER TABLE "project" ADD COLUMN "autoAssignTeam" BOOLEAN NOT NULL DEFAULT true;

-- Seul dans l'équipe : la conversation lui revient (inchangé).
-- En équipe et si le réglage est actif : au membre ou administrateur en ligne
-- le moins chargé (conversations ouvertes assignées), puis celui servi le moins
-- récemment. Le propriétaire n'est jamais choisi. Personne en ligne : non assignée.
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
          AND pm.role <> 'OWNER'
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
