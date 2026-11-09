import { test } from "node:test";
import assert from "node:assert/strict";
import {
  alternateWhatsAppDigits,
  androidWhatsAppLink,
  currentNumberDigits,
  knownWhatsAppDigits,
  sameWhatsAppNumber,
} from "../lib/whatsapp-number";

test("l’ancienne numérotation gabonaise s’écrit dans l’actuelle", () => {
  assert.equal(currentNumberDigits("24106845039"), "24166845039");
  assert.equal(currentNumberDigits("24107123456"), "24177123456");
  assert.equal(currentNumberDigits("24101123456"), "24111123456");
  // Déjà actuel, préfixe inconnu ou autre pays : inchangé.
  assert.equal(currentNumberDigits("24166845039"), "24166845039");
  assert.equal(currentNumberDigits("24103123456"), "24103123456");
  assert.equal(currentNumberDigits("33612345678"), "33612345678");
  assert.equal(currentNumberDigits("2410612345"), "2410612345");
});

test("chaque écriture gabonaise donne l’autre, et rien ailleurs", () => {
  assert.equal(alternateWhatsAppDigits("24166845039"), "24106845039");
  assert.equal(alternateWhatsAppDigits("24106845039"), "24166845039");
  assert.equal(alternateWhatsAppDigits("24162000001"), "24102000001");
  assert.equal(alternateWhatsAppDigits("24174000001"), "24104000001");
  assert.equal(alternateWhatsAppDigits("24165000001"), "24105000001");
  assert.equal(alternateWhatsAppDigits("24160000001"), null);
  assert.equal(alternateWhatsAppDigits("33612345678"), null);
  assert.equal(alternateWhatsAppDigits("241668450391"), null);
});

test("les deux écritures désignent le même numéro", () => {
  assert.ok(sameWhatsAppNumber("+241 66 84 50 39", "24106845039"));
  assert.ok(sameWhatsAppNumber("24106845039", "+241 06 84 50 39"));
  assert.ok(!sameWhatsAppNumber("+241 66 84 50 39", "24177845039"));
  assert.ok(!sameWhatsAppNumber("", ""));
});

test("seule une écriture qui a un compte WhatsApp est retenue", () => {
  const legacyOnly = [
    { exists: false, jid: "24166845039@s.whatsapp.net", number: "24166845039" },
    { exists: true, jid: "24106845039@s.whatsapp.net", number: "24106845039" },
  ];
  assert.equal(knownWhatsAppDigits(legacyOnly, "24166845039", "24106845039"), "24106845039");
  const both = legacyOnly.map((item) => ({ ...item, exists: true }));
  assert.equal(knownWhatsAppDigits(both, "24166845039", "24106845039"), "24166845039");
  // Réponse illisible ou aucun compte : le numéro saisi.
  assert.equal(knownWhatsAppDigits({ error: true }, "24166845039", "24106845039"), "24166845039");
  assert.equal(knownWhatsAppDigits([], "24166845039", "24106845039"), "24166845039");
});

test("sur Android, le lien ouvre l’application WhatsApp choisie", () => {
  const link = `https://wa.me/24176205629?text=${encodeURIComponent("Bonjour ExtravertyAI, voici mon code : 123456")}`;
  const business = androidWhatsAppLink(link, "business");
  assert.ok(business.startsWith("intent://send/?phone=24176205629&text=Bonjour%20ExtravertyAI"));
  assert.match(business, /;package=com\.whatsapp\.w4b;/);
  assert.match(business, /;S\.browser_fallback_url=https%3A%2F%2Fwa\.me%2F24176205629/);
  assert.match(androidWhatsAppLink(link, "whatsapp"), /;package=com\.whatsapp;/);
  // Autre adresse : laissée telle quelle.
  assert.equal(androidWhatsAppLink("https://example.com/x", "business"), "https://example.com/x");
});
