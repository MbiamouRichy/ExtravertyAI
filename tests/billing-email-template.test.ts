import assert from "node:assert/strict";
import { test } from "node:test";
import { BillingEmailTemplate } from "../components/emailTemplate/billingEmailTemplate";

const props = {
  title: "Votre essai est terminé",
  projectName: 'Projet <img src=x onerror="alert(1)"> & équipe',
  deadline: "11 octobre 2026 à 12:00 UTC",
  message: "Votre accès <test> est suspendu.",
  reminder: false,
  billingUrl: "https://app.example.test/projects/p/billing?a=1&b=2",
};
test("billing email escapes untrusted content and exposes the secure billing link", () => {
  const html = BillingEmailTemplate(props);
  assert.ok(html.includes("&lt;img"));
  assert.ok(!html.includes("<img"));
  assert.ok(html.includes("Votre accès &lt;test&gt; est suspendu."));
  assert.ok(
    html.includes(
      'href="https://app.example.test/projects/p/billing?a=1&amp;b=2"',
    ),
  );
  assert.ok(html.includes("11 octobre 2026 à 12:00 UTC"));
  assert.ok(html.includes("Votre historique reste accessible."));
  assert.ok(html.includes('lang="fr"'));
});
test("reminder does not claim access has already ended", () => {
  const html = BillingEmailTemplate({
    ...props,
    reminder: true,
    message: "Votre essai arrive bientôt à son terme.",
  });
  assert.ok(html.includes("seront suspendus"));
  assert.ok(!html.includes("sont suspendus"));
});
test("billing email rejects unsafe URL schemes", () => {
  for (const billingUrl of [
    "javascript:alert(1)",
    "https://user:password@example.test",
  ]) {
    assert.throws(() => BillingEmailTemplate({ ...props, billingUrl }));
  }
});
