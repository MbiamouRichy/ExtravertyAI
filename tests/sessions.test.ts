import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { z } from "zod";

// Exercise the server action with isolated auth/database boundaries, without
// loading production credentials or requiring a Next request context.
function setup(
  options: { authenticated?: boolean; owned?: boolean; fail?: boolean } = {},
) {
  const calls: string[] = [];
  const exports: Record<
    string,
    (
      input: unknown,
    ) => Promise<{ success: boolean; signedOut?: boolean; error?: string }>
  > = {};
  const modules: Record<string, unknown> = {
    zod: { z },
    "next/headers": { headers: async () => new Headers() },
    "@/lib/auth": {
      auth: {
        api: {
          getSession: async () =>
            options.authenticated === false
              ? null
              : { user: { id: "owner" }, session: { id: "current" } },
          revokeSession: async ({ body }: { body: { token: string } }) => {
            assert.equal(body.token, "server-only-token");
            calls.push("one");
            if (options.fail) throw new Error("private database details");
          },
          revokeSessions: async () => {
            calls.push("all");
          },
        },
      },
    },
    "@/lib/prisma": {
      default: {
        session: {
          findFirst: async ({
            where,
          }: {
            where: { userId: string; id: string };
          }) => {
            assert.equal(where.userId, "owner");
            calls.push(`lookup:${where.id}`);
            return options.owned === false
              ? null
              : { token: "server-only-token" };
          },
        },
      },
    },
  };
  const source = readFileSync("app/actions/sessions.ts", "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  runInNewContext(compiled, {
    exports,
    require: (name: string) => {
      assert.ok(name in modules, `Unexpected dependency: ${name}`);
      return modules[name];
    },
  });
  return { disconnect: exports.disconnectSessions, calls };
}

test("session revocation rejects invalid input and unauthenticated callers", async () => {
  const invalid = setup();
  assert.equal(
    (await invalid.disconnect({ scope: "one", sessionId: "" })).success,
    false,
  );
  assert.deepEqual(invalid.calls, []);
  const anonymous = setup({ authenticated: false });
  assert.equal((await anonymous.disconnect({ scope: "all" })).success, false);
  assert.deepEqual(anonymous.calls, []);
});

test("another user's session cannot be revoked and tokens never leave the server", async () => {
  const action = setup({ owned: false });
  const result = await action.disconnect({
    scope: "one",
    sessionId: "foreign",
  });
  assert.deepEqual(action.calls, ["lookup:foreign"]);
  assert.equal(result.signedOut, false);
  assert.ok(!JSON.stringify(result).includes("token"));
});

test("individual revocation distinguishes the current session from another device", async () => {
  for (const id of ["current", "other"]) {
    const action = setup();
    const result = await action.disconnect({ scope: "one", sessionId: id });
    assert.equal(result.success, true);
    assert.equal(result.signedOut, id === "current");
    assert.deepEqual(action.calls, [`lookup:${id}`, "one"]);
    assert.ok(!JSON.stringify(result).includes("server-only-token"));
  }
});

test("global revocation uses the authenticated account and signs out this device", async () => {
  const action = setup();
  const result = await action.disconnect({ scope: "all", userId: "foreign" });
  assert.equal(result.success, true);
  assert.equal(result.signedOut, true);
  assert.deepEqual(action.calls, ["all"]);
});

test("revocation errors return safe feedback", async () => {
  const action = setup({ fail: true });
  const result = await action.disconnect({ scope: "one", sessionId: "other" });
  assert.equal(result.success, false);
  assert.ok(!JSON.stringify(result).includes("private database details"));
});
