import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { z } from "zod";
import * as permissions from "../lib/project-permissions";
import * as billingDisplay from "../lib/billing-display";
import {
  isRecentSession,
  PROJECT_DELETION_SESSION_MAX_AGE_MS,
} from "../lib/recent-session";

const now = Date.parse("2026-10-11T06:00:00Z");
test("deletion freshness rejects the exact ten-minute boundary and invalid timestamps", () => {
  assert.equal(isRecentSession(new Date(now), now), true);
  assert.equal(isRecentSession(new Date(now - 599999), now), true);
  for (const value of [
    new Date(now - PROJECT_DELETION_SESSION_MAX_AGE_MS),
    new Date(now - 600001),
    new Date(now + 1),
    new Date(NaN),
    "",
    null,
    undefined,
    0,
  ]) {
    assert.equal(isRecentSession(value, now), false);
  }
});

function setup({
  age = 0,
  role = "OWNER",
  anonymous = false,
  member = true,
  invalid = false,
  exported = true,
  failAt = null as "billing" | "whatsapp" | "media" | null,
} = {}) {
  const calls: string[] = [];
  const exports: Record<
    string,
    (input: unknown) => Promise<{ success: boolean; code?: string }>
  > = {};
  const modules: Record<string, unknown> = {
    zod: { default: z },
    "next/cache": { revalidatePath: () => calls.push("revalidate") },
    "@/lib/auth-server": {
      getSession: async (options: unknown) => {
        assert.equal((options as { fresh: boolean }).fresh, true);
        return anonymous
          ? null
          : {
              user: { id: "owner" },
              session: {
                createdAt: invalid ? undefined : new Date(now - age),
                updatedAt: new Date(now),
              },
            };
      },
    },
    "@/lib/prisma": {
      default: {
        projectMembership: {
          findUnique: async (input: {
            where: { userId_projectId: { userId: string; projectId: string } };
          }) => {
            assert.equal(input.where.userId_projectId.userId, "owner");
            return member ? { role, project: { name: "Mon projet" } } : null;
          },
        },
      },
    },
    "./project-settings": {},
    "@/lib/project-deletion": {
      ProjectDeletionError,
      deleteProjectResources: async () => {
        calls.push("delete");
        if (failAt) throw new ProjectDeletionError("Étape interrompue.", failAt);
      },
    },
    "@/lib/billing-access": {},
    "@/lib/project-permissions": permissions,
    "@/lib/billing-display": billingDisplay,
    "@/lib/project-logo": { projectLogoUrl: () => null },
    "@/lib/contact-export": { contactExportSnapshot: async () => ({ hash: "snapshot" }), verifyExportReceipt: () => exported },
    "@/lib/recent-session": {
      isRecentSession: (created: unknown) => isRecentSession(created, now),
    },
  };
  const source = ts.transpileModule(
    readFileSync("app/actions/projects.ts", "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  runInNewContext(source, {
    exports,
    require: (id: string) => {
      assert.ok(id in modules, id);
      return modules[id];
    },
    console: { error: () => {} },
  });
  return {
    calls,
    remove: (confirmationName = "Mon projet") =>
      exports.deleteProjectAction({
        projectId: "cmuhe8ap1000004l64j9yddk1",
        confirmationName,
        csvReceipt: "csv-receipt",
        xlsxReceipt: "xlsx-receipt",
      }),
  };
}

class ProjectDeletionError extends Error {
  constructor(
    message: string,
    readonly step: string,
  ) {
    super(message);
  }
}

test("an interrupted deletion reports the step left so it can be finished", async () => {
  for (const failAt of ["billing", "whatsapp", "media"] as const) {
    const app = setup({ age: 1000, failAt });
    const result = (await app.remove()) as { success: boolean; code?: string; step?: string; error?: string };
    assert.equal(result.success, false);
    assert.equal(result.code, "DELETION_PENDING");
    assert.equal(result.step, failAt);
    assert.equal(result.error, "Étape interrompue.");
    // L'état « en cours de suppression » est rafraîchi pour toute l'application.
    assert.deepEqual(app.calls, ["delete", "revalidate"]);
  }
});

test("a fresh owner can delete with the correct confirmation", async () => {
  const app = setup({ age: 599999 });
  assert.equal((await app.remove()).success, true);
  assert.deepEqual(app.calls, ["delete", "revalidate"]);
});

for (const options of [
  { age: 600000 },
  { age: 600001 },
  { age: -1 },
  { invalid: true },
  { anonymous: true },
]) {
  test(
    "reauthentication precedes all destructive effects: " +
      JSON.stringify(options),
    async () => {
      const app = setup(options);
      assert.equal((await app.remove()).code, "REAUTH_REQUIRED");
      assert.deepEqual(app.calls, []);
    },
  );
}
for (const role of ["ADMIN", "MEMBER"]) {
  test(role + " cannot delete even with a fresh session", async () => {
    const app = setup({ role });
    assert.equal((await app.remove()).success, false);
    assert.deepEqual(app.calls, []);
  });
}
test("missing membership and wrong confirmation have no side effects", async () => {
  const foreign = setup({ member: false });
  assert.equal((await foreign.remove()).success, false);
  assert.deepEqual(foreign.calls, []);
  const wrong = setup();
  assert.equal((await wrong.remove("Autre projet")).success, false);
  assert.deepEqual(wrong.calls, []);
});

test("project deletion refuses absent, expired or obsolete export proof", async () => { const app = setup({ exported: false }); assert.equal((await app.remove()).code, "EXPORT_REQUIRED"); assert.deepEqual(app.calls, []); });
