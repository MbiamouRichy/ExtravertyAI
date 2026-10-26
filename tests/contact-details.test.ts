import { test } from "node:test";
import assert from "node:assert/strict";
import {
  contactEventLabel,
  contactSourceLabel,
  maskContactPhone,
} from "../lib/contact-details";

test("phone numbers are masked and never returned in clear", () => {
  assert.equal(maskContactPhone("24166845039"), "+241 6•• •• •• 39");
  assert.equal(maskContactPhone("+237 6 99 12 34 41"), "+237 6•• •• •• 41");
  const masked = maskContactPhone("24166845039") ?? "";
  assert.ok(!masked.includes("6684"));
});

test("invalid phone values are not displayed", () => {
  assert.equal(maskContactPhone(null), null);
  assert.equal(maskContactPhone("1234"), null);
  assert.equal(maskContactPhone("1".repeat(20)), null);
});

test("message sources map to readable labels", () => {
  assert.equal(contactSourceLabel("android"), "WhatsApp Android");
  assert.equal(contactSourceLabel("IOS"), "WhatsApp iPhone");
  assert.equal(contactSourceLabel("unknown"), "WhatsApp");
  assert.equal(contactSourceLabel(null), "WhatsApp");
});

test("AI events name the first name of the member, with a safe fallback", () => {
  assert.equal(
    contactEventLabel("AI_ENABLED", "Mbiamou Richy"),
    "Assistant IA réactivé par Mbiamou",
  );
  assert.equal(
    contactEventLabel("AI_PAUSED", null),
    "Un membre a repris la main · IA en pause",
  );
  assert.equal(
    contactEventLabel("AI_PAUSED_FROM_PHONE"),
    "Réponse depuis le téléphone · IA en pause",
  );
});
