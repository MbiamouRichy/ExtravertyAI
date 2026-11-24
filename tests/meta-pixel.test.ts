import { test } from "node:test";
import assert from "node:assert/strict";
import {
  claimRegistrationSignal,
  isFreshAccount,
  isMetaTrackableLocation,
  isMetaTrackablePath,
  parseMetaPixelId,
  REGISTRATION_SENT_KEY,
  REGISTRATION_WINDOW_MS,
} from "../lib/meta-pixel";

test("parseMetaPixelId n'accepte que des identifiants numériques", () => {
  assert.equal(parseMetaPixelId("1234567890123456"), "1234567890123456");
  assert.equal(parseMetaPixelId("  1234567890123456 "), "1234567890123456");
  assert.equal(parseMetaPixelId(""), null);
  assert.equal(parseMetaPixelId(undefined), null);
  assert.equal(parseMetaPixelId("123"), null);
  assert.equal(parseMetaPixelId("12345678901');alert(1)//"), null);
});

test("isMetaTrackablePath écarte l'espace connecté et les pages sensibles", () => {
  for (const path of ["/", "/sign-up", "/sign-in", "/tarifs", "/aide/statistiques", "/projects"])
    assert.equal(isMetaTrackablePath(path), true, path);
  for (const path of [
    "/projects/abc123",
    "/projects/abc123/chat",
    "/admin",
    "/admin/paiements",
    "/api/pv",
    "/invite",
    "/reset-password",
    "/verify",
    "/goodbye",
    "/maquettes/x",
  ])
    assert.equal(isMetaTrackablePath(path), false, path);
  assert.equal(isMetaTrackablePath(null), false);
  assert.equal(isMetaTrackablePath("projects"), false);
});

test("isMetaTrackableLocation écarte les adresses aux paramètres privés", () => {
  assert.equal(
    isMetaTrackableLocation("/sign-up", "?utm_source=meta&utm_campaign=video-awa&fbclid=abc"),
    true,
  );
  assert.equal(isMetaTrackableLocation("/", ""), true);
  assert.equal(isMetaTrackableLocation("/sign-in", "?callbackUrl=%2Fprojects%2Fabc123"), false);
  assert.equal(isMetaTrackableLocation("/sign-in", "?CallbackURL=%2Fprojects"), false);
  assert.equal(isMetaTrackableLocation("/sign-up", "?email=a%40b.c"), false);
  assert.equal(isMetaTrackableLocation("/sign-up", "?token=x"), false);
  assert.equal(isMetaTrackableLocation("/projects/abc", ""), false);
});

test("isFreshAccount ne retient que les comptes tout juste créés", () => {
  const now = Date.UTC(2026, 10, 24, 12, 0, 0);
  assert.equal(isFreshAccount(new Date(now - 60_000), now), true);
  assert.equal(isFreshAccount(new Date(now - 60_000).toISOString(), now), true);
  assert.equal(isFreshAccount(now - REGISTRATION_WINDOW_MS - 1, now), false);
  assert.equal(isFreshAccount(now + 30_000, now), true);
  assert.equal(isFreshAccount(now + 5 * 60_000, now), false);
  assert.equal(isFreshAccount("pas une date", now), false);
  assert.equal(isFreshAccount(null, now), false);
});

function memoryStore() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

test("claimRegistrationSignal n'envoie l'inscription qu'une fois par compte", () => {
  const store = memoryStore();
  assert.equal(claimRegistrationSignal(store, "user-1"), true);
  assert.equal(claimRegistrationSignal(store, "user-1"), false);
  assert.equal(store.getItem(REGISTRATION_SENT_KEY), "user-1");
  assert.equal(claimRegistrationSignal(store, "user-2"), true);
});

test("claimRegistrationSignal n'envoie rien sans stockage utilisable", () => {
  assert.equal(claimRegistrationSignal(null, "user-1"), false);
  const broken = {
    getItem: () => {
      throw new Error("bloqué");
    },
    setItem: () => {},
  };
  assert.equal(claimRegistrationSignal(broken, "user-1"), false);
  const readOnly = { getItem: () => null, setItem: () => {} };
  assert.equal(claimRegistrationSignal(readOnly, "user-1"), false);
  assert.equal(claimRegistrationSignal(memoryStore(), ""), false);
});
