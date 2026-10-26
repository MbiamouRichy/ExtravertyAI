import assert from "node:assert/strict";
import { test } from "node:test";
import { AccountDeletedEmailTemplate } from "../components/emailTemplate/accountDeletedEmailTemplate";
import { ChangeEmailTemplate } from "../components/emailTemplate/changeEmailTemplate";
import { DeleteAccountEmailTemplate } from "../components/emailTemplate/DeleteAccountEmailTemplate";
import { EmailTemplate } from "../components/emailTemplate/emailTemplate";
import { ProjectInvitationEmail } from "../components/emailTemplate/invitationEmail";
import { ProjectMemberConfirmationEmail } from "../components/emailTemplate/projectMemberConfirmationEmail";
import { ResetPasswordTemplate } from "../components/emailTemplate/resetPasswordTemplate";

const evil = '<img src=x onerror="alert(1)">';
const url = "https://app.example.test/path?a=1&b=2";

const templates: ((link: string) => string)[] = [
  (link) => EmailTemplate({ url: link, email: evil }),
  (link) => ResetPasswordTemplate({ url: link, email: evil }),
  (link) => ChangeEmailTemplate({ url: link, newEmail: evil }),
  (link) => DeleteAccountEmailTemplate({ url: link }),
  (link) => ProjectInvitationEmail({ inviterName: evil, projectName: evil, role: "ADMIN", inviteUrl: link, email: evil }),
  (link) => ProjectMemberConfirmationEmail({ userName: evil, inviterName: evil, projectName: evil, role: "AGENT", projectUrl: link, email: evil }),
];

test("account and team emails escape user-controlled values", () => {
  for (const html of templates.map((render) => render(url))) {
    assert.ok(!html.includes("<img src=x"));
    assert.ok(html.includes('href="https://app.example.test/path?a=1&amp;b=2"'));
    assert.ok(html.includes('src="https://extravertyai.com/logo-email.png"'));
    assert.ok(html.includes('lang="fr"'));
  }
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
