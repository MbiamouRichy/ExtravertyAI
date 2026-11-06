import { test } from "node:test";
import assert from "node:assert/strict";

import { buildMigrationDecision } from "../lib/build-migrations";

test("le build de production migre sa base", () => {
  assert.equal(
    buildMigrationDecision({ VERCEL_ENV: "production", VERCEL_GIT_COMMIT_REF: "master" }).migrate,
    true,
  );
});

test("la préversion codex/preproduction migre sa base", () => {
  assert.equal(
    buildMigrationDecision({ VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "codex/preproduction" }).migrate,
    true,
  );
});

test("une autre branche de préversion ne migre jamais", () => {
  for (const branch of ["claude/audit-securite-uiux-5b62bb", "fix/hydratation-declencheurs", "", undefined]) {
    const decision = buildMigrationDecision({ VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: branch });
    assert.equal(decision.migrate, false, `branche ${branch}`);
  }
});

test("un nom de branche proche n'est pas confondu avec la préversion", () => {
  for (const branch of ["codex/preproduction-test", "codex/Preproduction", "preproduction"]) {
    assert.equal(
      buildMigrationDecision({ VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: branch }).migrate,
      false,
      branch,
    );
  }
});

test("hors Vercel et en développement, aucune migration", () => {
  assert.equal(buildMigrationDecision({}).migrate, false);
  assert.equal(buildMigrationDecision({ VERCEL_ENV: "development" }).migrate, false);
});

test("SKIP_BUILD_MIGRATIONS=1 désactive la migration, même en production", () => {
  const decision = buildMigrationDecision({ VERCEL_ENV: "production", SKIP_BUILD_MIGRATIONS: "1" });
  assert.equal(decision.migrate, false);
  assert.match(decision.reason, /SKIP_BUILD_MIGRATIONS/);
});
