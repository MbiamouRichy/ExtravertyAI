export const PROJECT_DELETION_SESSION_MAX_AGE_MS = 10 * 60 * 1000;

// Refreshing a session is not a login: use createdAt, never updatedAt.
export function isRecentSession(createdAt: unknown, now = Date.now()): boolean {
  if (!(createdAt instanceof Date) && typeof createdAt !== "string")
    return false;
  const age = now - new Date(createdAt).getTime();
  return (
    Number.isFinite(age) &&
    age >= 0 &&
    age < PROJECT_DELETION_SESSION_MAX_AGE_MS
  );
}
