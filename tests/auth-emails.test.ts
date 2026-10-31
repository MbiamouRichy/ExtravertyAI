import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { test } from "node:test";
import ts from "typescript";

type Send = (input: Record<string, unknown>) => Promise<void>;

function loadAuth(result: { data: unknown; error: { message: string } | null }) {
  const sent: string[] = [];
  const logged: unknown[][] = [];
  let config: {
    emailAndPassword: { sendResetPassword: Send };
    emailVerification: { sendVerificationEmail: Send };
    user: {
      changeEmail: { sendChangeEmailConfirmation: Send };
      deleteUser: {
        afterDelete: (user: { id: string; email: string }) => Promise<void>;
      };
    };
  };
  const source = ts.transpileModule(readFileSync("lib/auth.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  runInNewContext(source, {
    exports: {},
    process: { env: {} },
    console: { error: (...args: unknown[]) => logged.push(args) },
    require: (id: string) => {
      if (id === "better-auth")
        return {
          betterAuth: (value: typeof config) => {
            config = value;
            return value;
          },
        };
      if (id === "better-auth/api")
        return { createAuthMiddleware: (fn: unknown) => fn };
      if (id === "better-auth/adapters/prisma")
        return { prismaAdapter: () => ({}) };
      if (id === "./resend")
        return {
          resend: {
            emails: {
              send: async (message: { subject: string }) => {
                sent.push(message.subject);
                return result;
              },
            },
          },
        };
      if (id === "./account-deletion-records")
        return { recordAccountDeletion: async () => undefined };
      if (id.startsWith("@/components/emailTemplate/"))
        return new Proxy({}, { get: () => () => "<p>email</p>" });
      return {};
    },
  });
  const steps: [string, () => Promise<void>][] = [
    [
      "reset",
      () =>
        config.emailAndPassword.sendResetPassword({
          user: { email: "a@example.test" },
          url: "https://app.test/reset",
        }),
    ],
    [
      "change",
      () =>
        config.user.changeEmail.sendChangeEmailConfirmation({
          user: { email: "a@example.test" },
          newEmail: "b@example.test",
          url: "https://app.test/change",
        }),
    ],
  ];
  return {
    steps,
    sent,
    logged,
    sendVerification: () =>
      config.emailVerification.sendVerificationEmail({
        user: { email: "a@example.test" },
        url: "https://app.test/verify",
      }),
    afterDelete: () =>
      config.user.deleteUser.afterDelete({ id: "u1", email: "a@example.test" }),
  };
}

test("a refused verification email is logged but never thrown to the public route", async () => {
  const refused = loadAuth({
    data: null,
    error: { message: "API key is invalid" },
  });
  await refused.sendVerification();
  assert.equal(refused.logged.length, 1);
  assert.equal(refused.logged[0][0], "VERIFICATION_EMAIL_FAILED");

  const accepted = loadAuth({ data: { id: "email_1" }, error: null });
  await accepted.sendVerification();
  assert.equal(accepted.logged.length, 0);
});

test("a send refused by Resend fails the reset and change emails", async () => {
  const { steps, sent } = loadAuth({
    data: null,
    error: { message: "API key is invalid" },
  });
  for (const [, run] of steps) {
    await assert.rejects(run(), /Resend: API key is invalid/);
  }
  assert.equal(sent.length, steps.length);
});

test("accepted auth emails resolve", async () => {
  const { steps, sent } = loadAuth({ data: { id: "email_1" }, error: null });
  for (const [, run] of steps) await run();
  assert.equal(sent.length, steps.length);
});

test("a refused deletion email is logged without failing the finished deletion", async () => {
  const refused = loadAuth({
    data: null,
    error: { message: "API key is invalid" },
  });
  await refused.afterDelete();
  assert.equal(refused.logged.length, 1);
  assert.equal(refused.logged[0][0], "ACCOUNT_DELETED_EMAIL_FAILED");

  const accepted = loadAuth({ data: { id: "email_1" }, error: null });
  await accepted.afterDelete();
  assert.equal(accepted.logged.length, 0);
  assert.deepEqual(accepted.sent, ["Votre compte ExtravertyAI a été supprimé"]);
});
