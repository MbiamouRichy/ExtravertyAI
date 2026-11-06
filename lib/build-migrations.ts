// Décide si un build Vercel applique les migrations Prisma (`prisma migrate
// deploy`). Chaque build reçoit le DATABASE_URL de son environnement : un
// build de production migre la base de production, un build Preview celle de
// la préversion. Les autres branches ne migrent jamais : tant que préversion
// et production partagent la même base, une branche d'essai modifierait sinon
// les données réelles.

/** Branches de préversion dont le build applique les migrations. */
export const MIGRATING_PREVIEW_BRANCHES: readonly string[] = [
  "codex/preproduction",
];

export type BuildMigrationDecision = {
  migrate: boolean;
  /** Raison lisible, écrite dans le journal du build. */
  reason: string;
};

export function buildMigrationDecision(
  env: Record<string, string | undefined>,
): BuildMigrationDecision {
  // Échappatoire : relancer un build sans toucher à la base.
  if (env.SKIP_BUILD_MIGRATIONS === "1")
    return { migrate: false, reason: "désactivées par SKIP_BUILD_MIGRATIONS=1" };

  const target = env.VERCEL_ENV;
  // Build local ou CI : la base se migre à la main avec `npm run db:deploy`.
  if (!target) return { migrate: false, reason: "build hors Vercel" };
  if (target === "production")
    return { migrate: true, reason: "build de production" };

  const branch = env.VERCEL_GIT_COMMIT_REF?.trim();
  if (target === "preview" && branch && MIGRATING_PREVIEW_BRANCHES.includes(branch))
    return { migrate: true, reason: `préversion de ${branch}` };

  return {
    migrate: false,
    reason: `environnement ${target}, branche ${branch || "inconnue"}`,
  };
}
