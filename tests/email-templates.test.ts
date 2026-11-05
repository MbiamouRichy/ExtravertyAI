import assert from "node:assert/strict";
import { test } from "node:test";
import { AccountDeletedEmailTemplate } from "../components/emailTemplate/accountDeletedEmailTemplate";
import { ChangeEmailTemplate } from "../components/emailTemplate/changeEmailTemplate";
import { DeleteAccountEmailTemplate } from "../components/emailTemplate/DeleteAccountEmailTemplate";
import { EmailTemplate } from "../components/emailTemplate/emailTemplate";
import { ExistingAccountTemplate } from "../components/emailTemplate/existingAccountTemplate";
import { VerificationCodeTemplate } from "../components/emailTemplate/verificationCodeTemplate";
import { ProjectInvitationEmail } from "../components/emailTemplate/invitationEmail";
import { ResetPasswordTemplate } from "../components/emailTemplate/resetPasswordTemplate";

const evil = '<img src=x onerror="alert(1)">';
const url = "https://app.example.test/path?a=1&b=2";

const templates: ((link: string) => string)[] = [
  (link) => EmailTemplate({ url: link, email: evil }),
  (link) => ResetPasswordTemplate({ url: link, email: evil }),
  (link) => ExistingAccountTemplate({ email: evil, signInUrl: link, resetUrl: link }),
  (link) => ChangeEmailTemplate({ url: link, newEmail: evil }),
  (link) => DeleteAccountEmailTemplate({ url: link }),
  (link) => ProjectInvitationEmail({ inviterName: evil, projectName: evil, role: "ADMIN", inviteUrl: link, email: evil, hasAccount: false }),
  (link) => ProjectInvitationEmail({ inviterName: evil, projectName: evil, role: "AGENT", inviteUrl: link, email: evil, hasAccount: true }),
];

test("account and team emails escape user-controlled values", () => {
  for (const html of templates.map((render) => render(url))) {
    assert.ok(!html.includes("<img src=x"));
    assert.ok(html.includes('href="https://app.example.test/path?a=1&amp;b=2"'));
    assert.ok(html.includes('src="https://extravertyai.com/logo-email.png"'));
    assert.ok(html.includes('lang="fr"'));
  }
});

test("verification code email shows the code, escapes the address and refuses anything but digits", () => {
  const html = VerificationCodeTemplate({ code: "048213", email: evil, minutes: 10 });
  assert.ok(html.includes("048213"));
  assert.ok(!html.includes("<img src=x"));
  assert.ok(!html.includes('class="email-button'));
  assert.throws(() => VerificationCodeTemplate({ code: "<b>1</b>", email: "a@example.test", minutes: 10 }));
});

test("sign-in code email says it is a sign-in code, not an activation", () => {
  const html = VerificationCodeTemplate({ code: "204816", email: evil, minutes: 10, purpose: "sign-in" });
  assert.ok(html.includes("204816"));
  assert.ok(html.includes("Votre code de connexion"));
  assert.ok(!html.includes("aucun compte ne sera activé"));
  assert.ok(!html.includes("<img src=x"));
  assert.ok(!html.includes('class="email-button'));
});

test("sign-up code email says it creates an account, and how to refuse it", () => {
  const html = VerificationCodeTemplate({ code: "731905", email: evil, minutes: 10, purpose: "sign-up" });
  assert.ok(html.includes("731905"));
  assert.ok(html.includes("Votre code d’inscription"));
  assert.ok(html.includes("aucun compte ne sera créé sans ce code"));
  assert.ok(!html.includes("Votre code de connexion"));
  assert.ok(!html.includes("<img src=x"));
  assert.ok(!html.includes('class="email-button'));
});

test("account deleted email escapes project names and contains no action link", () => {
  const html = AccountDeletedEmailTemplate({
    email: evil,
    deletedAt: new Date("2026-10-14T10:00:00Z"),
    projects: [evil, "Boutique & Co"],
    leftProjects: 2,
  });
  assert.ok(!html.includes("<img src=x"));
  assert.ok(html.includes("Boutique &amp; Co"));
  assert.ok(!html.includes('class="email-button'));
});

test("account and team emails reject unsafe link schemes", () => {
  for (const link of ["javascript:alert(1)", "https://user:pass@example.test"]) {
    for (const render of templates) assert.throws(() => render(link));
  }
});
