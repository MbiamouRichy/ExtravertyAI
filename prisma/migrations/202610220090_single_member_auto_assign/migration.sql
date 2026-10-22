-- Équipe d'un seul membre : chaque conversation lui est assignée automatiquement.
-- Fait en base pour couvrir toutes les créations de contact (webhook, rapprochement).
CREATE OR REPLACE FUNCTION contact_auto_assign_single_member() RETURNS trigger AS $$
DECLARE
  sole TEXT;
BEGIN
  IF NEW."assigneeId" IS NULL THEN
    SELECT min(pm."userId") INTO sole
    FROM project_membership pm
    WHERE pm."projectId" = NEW."projectId"
    HAVING count(*) = 1;
    IF sole IS NOT NULL THEN
      NEW."assigneeId" := sole;
      NEW."assignedAt" := COALESCE(NEW."assignedAt", now() AT TIME ZONE 'UTC');
    END IF;
  END IF;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER contact_auto_assign_single_member
  BEFORE INSERT ON contact
  FOR EACH ROW EXECUTE FUNCTION contact_auto_assign_single_member();

-- Rattrapage : contacts non assignés des projets qui n'ont qu'un membre.
UPDATE contact c
SET "assigneeId" = s."userId", "assignedAt" = now() AT TIME ZONE 'UTC'
FROM (
  SELECT "projectId", min("userId") AS "userId"
  FROM project_membership
  GROUP BY "projectId"
  HAVING count(*) = 1
) s
WHERE c."projectId" = s."projectId" AND c."assigneeId" IS NULL;
