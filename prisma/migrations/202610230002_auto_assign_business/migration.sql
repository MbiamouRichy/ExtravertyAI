-- L'assignation automatique au membre unique est réservée à l'offre Business.
CREATE OR REPLACE FUNCTION contact_auto_assign_single_member() RETURNS trigger AS $$
DECLARE
  sole TEXT;
BEGIN
  IF NEW."assigneeId" IS NULL THEN
    SELECT min(pm."userId") INTO sole
    FROM project_membership pm
    JOIN project p ON p.id = pm."projectId"
    WHERE pm."projectId" = NEW."projectId" AND p.plan = 'business'
    HAVING count(*) = 1;
    IF sole IS NOT NULL THEN
      NEW."assigneeId" := sole;
      NEW."assignedAt" := COALESCE(NEW."assignedAt", now() AT TIME ZONE 'UTC');
    END IF;
  END IF;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;
