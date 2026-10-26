import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { test } from "node:test";
import ts from "typescript";
import { isRecentSession } from "../lib/recent-session";

test("direct account deletion and legacy callbacks require authoritative login under ten minutes", async () => {
  const now = Date.now();
  let createdAt: unknown = new Date(now);
  let reads = 0;
  let blockers: { id: string; name: string; members: number }[] = [];
  let config: {
    hooks: { before: (ctx: { path: string; body?: unknown }) => Promise<void> };
    user: { deleteUser: Record<string, unknown> };
  };
  class ApiError extends Error {
    constructor(_status: string, data: { code: string }) {
      super(data.code);
    }
  }
  const source = ts.transpileModule(readFileSync("lib/auth.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  runInNewContext(source, {
    exports: {},
    process: { env: {} },
    require: (id: string) => {
      if (id === "better-auth")
        return {
          betterAuth: (value: typeof config) => {
            config = value;
            return value;
          },
        };
      if (id === "better-auth/api")
        return {
          APIError: ApiError,
          createAuthMiddleware: (fn: unknown) => fn,
          getAuthoritativeSessionFromCtx: async () => {
            reads++;
            return createdAt === null ? null : { session: { createdAt } };
          },
        };
      if (id === "./recent-session")
        return {
          isRecentSession: (value: unknown) => isRecentSession(value, now),
        };
      if (id === "./account-deletion")
        return {
          getAccountDeletionPlan: async () => ({ blockers, deleted: [], left: 0 }),
        };
      if (id === "better-auth/adapters/prisma")
        return { prismaAdapter: () => ({}) };
      return {};
    },
  });
  assert.equal(
    config!.user.deleteUser.sendDeleteAccountVerification,
    undefined,
  );
  for (const path of ["/delete-user", "/delete-user/callback"]) {
    createdAt = new Date(now - 599999);
    await config!.hooks.before({ path });
    for (const invalid of [
      new Date(now - 600000),
      new Date(now + 1),
      undefined,
      null,
    ]) {
      createdAt = invalid;
      // Even a submitted password must not bypass the new policy.
      await assert.rejects(
        config!.hooks.before({ path, body: { password: "valid-password" } }),
        /REAUTH_REQUIRED/,
      );
    }
  }
  assert.equal(reads, 10);
  await config!.hooks.before({ path: "/update-user" });
  assert.equal(reads, 10);

  // A fresh session still cannot delete an account that solely owns a shared project.
  createdAt = new Date(now);
  blockers = [{ id: "p1", name: "Shared", members: 2 }];
  for (const path of ["/delete-user", "/delete-user/callback"]) {
    await assert.rejects(
      config!.hooks.before({ path }),
      /OWNERSHIP_TRANSFER_REQUIRED/,
    );
  }
});
