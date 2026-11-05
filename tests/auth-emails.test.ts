import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { test } from "node:test";
import ts from "typescript";

type Send = (input: Record<string, unknown>) => Promise<void>;
type OtpOptions = {
  storeOTP: string;
  disableSignUp: boolean;
  sendVerificationOTP: Send;
};

function loadAuth(
  result: { data: unknown; error: { message: string } | null },
  db: { storedEmail?: string } = {},
) {
  const sent: string[] = [];
  const logged: unknown[][] = [];
  const otpRequests: unknown[] = [];
  // Rows of the verification table used as throttles.
  const rows: { identifier: string; expiresAt: Date }[] = [];
  const matches = (
    row: { identifier: string; expiresAt: Date },
    where: { identifier: string; expiresAt?: { gt?: Date; lte?: Date } },
  ) =>
    row.identifier === where.identifier &&
    (!where.expiresAt?.gt || row.expiresAt > where.expiresAt.gt) &&
    (!where.expiresAt?.lte || row.expiresAt <= where.expiresAt.lte);
  let config: {
    disabledPaths: string[];
    hooks: { before: (ctx: Record<string, unknown>) => Promise<void> };
    plugins: { options: OtpOptions }[];
    emailAndPassword: {
      requireEmailVerification: boolean;
      sendResetPassword: Send;
      onExistingUserSignUp: Send;
    };
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
  const prisma = {
    user: {
      findUnique: async () => ({ email: db.storedEmail ?? "a@example.test" }),
    },
    verification: {
      findFirst: async ({ where }: { where: Parameters<typeof matches>[1] }) =>
        rows.some((row) => matches(row, where)) ? { id: "v1" } : null,
      count: async ({ where }: { where: Parameters<typeof matches>[1] }) =>
        rows.filter((row) => matches(row, where)).length,
      deleteMany: async ({ where }: { where: Parameters<typeof matches>[1] }) => {
        const kept = rows.filter((row) => !matches(row, where));
        const count = rows.length - kept.length;
        rows.splice(0, rows.length, ...kept);
        return { count };
      },
      create: async ({ data }: { data: { identifier: string; expiresAt: Date } }) => {
        rows.push({ identifier: data.identifier, expiresAt: data.expiresAt });
        return data;
      },
    },
  };
  runInNewContext(source, {
    exports: {},
    crypto,
    process: { env: { NEXT_PUBLIC_APP_URL: "https://app.test" } },
    console: { error: (...args: unknown[]) => logged.push(args) },
    require: (id: string) => {
      if (id === "better-auth")
        return {
          betterAuth: (value: typeof config) => {
            config = value;
            return {
              ...value,
              api: {
                sendVerificationOTP: async (request: unknown) => {
                  otpRequests.push(request);
                },
              },
            };
          },
        };
      if (id === "better-auth/api")
        return {
          createAuthMiddleware: (fn: unknown) => fn,
          APIError: class extends Error {
            constructor(status: string, body: { code: string }) {
              super(body.code);
              this.name = status;
            }
          },
        };
      if (id === "better-auth/plugins/email-otp")
        return { emailOTP: (options: OtpOptions) => ({ id: "email-otp", options }) };
      if (id === "next/server") return { after: () => undefined };
      if (id === "./recent-session")
        return { requiresRecentSession: () => false, isRecentSession: () => true };
      if (id === "./prisma") return { __esModule: true, default: prisma };
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
    otpRequests,
    config: () => config,
    otp: () => config.plugins[0].options,
    requestCode: (email: string, type: string | null = "sign-in") =>
      config.hooks.before({
        path: "/email-otp/send-verification-otp",
        body: { email, type },
      }),
    // Moves every throttle window to its end.
    expireThrottles: () => {
      for (const row of rows) row.expiresAt = new Date(0);
    },
    sendVerification: (email = "a@example.test") =>
      config.emailVerification.sendVerificationEmail({
        user: { id: "u1", email },
        url: "https://app.test/verify",
      }),
    existingSignUp: () =>
      config.emailAndPassword.onExistingUserSignUp({
        user: { id: "u1", email: "a@example.test" },
      }),
    afterDelete: () =>
      config.user.deleteUser.afterDelete({ id: "u1", email: "a@example.test" }),
  };
}

test("an unconfirmed current address gets a one-time code, not a link", async () => {
  const auth = loadAuth({ data: { id: "email_1" }, error: null });
  await auth.sendVerification();
  // Objects built inside the VM have another prototype: compare their JSON.
  assert.equal(
    JSON.stringify(auth.otpRequests),
    JSON.stringify([{ body: { email: "a@example.test", type: "email-verification" } }]),
  );
  assert.deepEqual(auth.sent, []);
});

test("a change of address is still confirmed by link on the new address", async () => {
  const refused = loadAuth(
    { data: null, error: { message: "API key is invalid" } },
    { storedEmail: "old@example.test" },
  );
  await refused.sendVerification("new@example.test");
  assert.equal(refused.otpRequests.length, 0);
  assert.equal(refused.logged.length, 1);
  assert.equal(refused.logged[0][0], "VERIFICATION_EMAIL_FAILED");

  const accepted = loadAuth(
    { data: { id: "email_1" }, error: null },
    { storedEmail: "old@example.test" },
  );
  await accepted.sendVerification("new@example.test");
  assert.deepEqual(accepted.sent, ["Verifier votre adresse e-mail"]);
  assert.equal(accepted.logged.length, 0);
});

test("codes are hashed, verification is required and only verification and sign-in codes exist", async () => {
  const auth = loadAuth({ data: { id: "email_1" }, error: null });
  const config = auth.config();
  assert.equal(config.emailAndPassword.requireEmailVerification, true);
  assert.equal(auth.otp().storeOTP, "hashed");
  assert.equal(auth.otp().disableSignUp, true);
  assert.ok(!config.disabledPaths.includes("/sign-in/email-otp"));
  for (const path of [
    "/forget-password/email-otp",
    "/email-otp/reset-password",
    "/email-otp/change-email",
  ])
    assert.ok(config.disabledPaths.includes(path));
  for (const type of ["forget-password", "change-email", null])
    await assert.rejects(auth.requestCode("a@example.test", type), /OTP_TYPE_NOT_ALLOWED/);
  await auth.requestCode("a@example.test", "email-verification");
  await auth.requestCode("a@example.test", "sign-in");
});

test("sign-in codes are capped per address, for every address alike", async () => {
  const auth = loadAuth({ data: { id: "email_1" }, error: null });
  for (let i = 0; i < 5; i++) await auth.requestCode("Victim@Example.test ");
  await assert.rejects(auth.requestCode("victim@example.test"), /TOO_MANY_CODES/);
  // Other addresses and verification codes keep their own budget.
  await auth.requestCode("other@example.test");
  await auth.requestCode("victim@example.test", "email-verification");
  // The budget comes back once the window ends.
  auth.expireThrottles();
  await auth.requestCode("victim@example.test");
});

test("a refused code email is logged but never thrown to the public route", async () => {
  const refused = loadAuth({ data: null, error: { message: "API key is invalid" } });
  await refused.otp().sendVerificationOTP({
    email: "a@example.test",
    otp: "123456",
    type: "email-verification",
  });
  assert.equal(refused.logged.length, 1);
  assert.equal(refused.logged[0][0], "VERIFICATION_CODE_FAILED");

  const accepted = loadAuth({ data: { id: "email_1" }, error: null });
  await accepted.otp().sendVerificationOTP({
    email: "a@example.test",
    otp: "123456",
    type: "email-verification",
  });
  await accepted.otp().sendVerificationOTP({
    email: "a@example.test",
    otp: "654321",
    type: "sign-in",
  });
  await accepted.otp().sendVerificationOTP({
    email: "a@example.test",
    otp: "111111",
    type: "forget-password",
  });
  assert.deepEqual(accepted.sent, [
    "123456 est votre code de vérification ExtravertyAI",
    "654321 est votre code de connexion ExtravertyAI",
  ]);
});

test("a sign-up on an existing address warns its owner once per window, silently", async () => {
  const accepted = loadAuth({ data: { id: "email_1" }, error: null });
  await accepted.existingSignUp();
  await accepted.existingSignUp();
  assert.deepEqual(accepted.sent, ["Vous avez déjà un compte ExtravertyAI"]);

  const refused = loadAuth({ data: null, error: { message: "API key is invalid" } });
  await refused.existingSignUp();
  assert.equal(refused.logged.length, 1);
  assert.equal(refused.logged[0][0], "EXISTING_ACCOUNT_EMAIL_FAILED");
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
