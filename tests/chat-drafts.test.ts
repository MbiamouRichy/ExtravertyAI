import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DRAFT_TTL_MS,
  clearChatDrafts,
  draftKey,
  parseStoredDraft,
  readChatDrafts,
  serializeDraft,
  writeChatDraft,
} from "../lib/chat-drafts";

/** Stockage du navigateur en mémoire, même interface que localStorage. */
class MemoryStorage implements Storage {
  private items = new Map<string, string>();
  get length() {
    return this.items.size;
  }
  clear() {
    this.items.clear();
  }
  getItem(key: string) {
    return this.items.get(key) ?? null;
  }
  key(index: number) {
    return [...this.items.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.items.delete(key);
  }
  setItem(key: string, value: string) {
    this.items.set(key, String(value));
  }
}

const NOW = 1_800_000_000_000;

test("serializeDraft ne garde rien pour un brouillon vide ou fait d’espaces", () => {
  assert.equal(serializeDraft({ reply: "", note: "", noteMode: false }, NOW), null);
  assert.equal(serializeDraft({ reply: "  \n", note: " ", noteMode: true }, NOW), null);
});

test("serializeDraft ne rouvre le mode note que s’il reste une note", () => {
  const withNote = serializeDraft({ reply: "", note: "À rappeler", noteMode: true }, NOW);
  assert.deepEqual(JSON.parse(withNote!), { note: "À rappeler", noteMode: true, at: NOW });

  const replyOnly = serializeDraft({ reply: "Bonjour", note: "", noteMode: true }, NOW);
  assert.deepEqual(JSON.parse(replyOnly!), { reply: "Bonjour", at: NOW });
});

test("parseStoredDraft relit un brouillon valide, tel qu’il a été laissé", () => {
  const raw = serializeDraft(
    { reply: "Bonjour,\n  à demain", note: "Client pressé", noteMode: true },
    NOW,
  );
  assert.deepEqual(parseStoredDraft(raw, NOW + 1000), {
    reply: "Bonjour,\n  à demain",
    note: "Client pressé",
    noteMode: true,
  });
});

test("parseStoredDraft écarte un contenu illisible, mal formé ou expiré", () => {
  assert.equal(parseStoredDraft(null, NOW), null);
  assert.equal(parseStoredDraft("{pas du json", NOW), null);
  assert.equal(parseStoredDraft(JSON.stringify({ reply: 42, at: NOW }), NOW), null);
  assert.equal(parseStoredDraft(JSON.stringify({ reply: "Salut" }), NOW), null);
  assert.equal(
    parseStoredDraft(JSON.stringify({ reply: "Salut", noteMode: "oui", at: NOW }), NOW),
    null,
  );
  const raw = serializeDraft({ reply: "Salut", note: "", noteMode: false }, NOW);
  assert.ok(parseStoredDraft(raw, NOW + DRAFT_TTL_MS));
  assert.equal(parseStoredDraft(raw, NOW + DRAFT_TTL_MS + 1), null);
});

test("writeChatDraft écrit puis supprime la clé quand le brouillon est vidé", () => {
  const storage = new MemoryStorage();
  const key = draftKey("user-1", "project-1", "contact-1");

  writeChatDraft(key, { reply: "Bonjour", note: "", noteMode: false }, NOW, storage);
  assert.ok(storage.getItem(key));

  writeChatDraft(key, { reply: "", note: "", noteMode: false }, NOW, storage);
  assert.equal(storage.getItem(key), null);
});

test("readChatDrafts ne lit que le compte et le projet demandés, et purge l’expiré", () => {
  const storage = new MemoryStorage();
  const draft = { reply: "Bonjour", note: "", noteMode: false };
  writeChatDraft(draftKey("user-1", "project-1", "a"), draft, NOW, storage);
  writeChatDraft(draftKey("user-1", "project-1", "b"), draft, NOW - DRAFT_TTL_MS - 1, storage);
  writeChatDraft(draftKey("user-2", "project-1", "a"), draft, NOW, storage);
  writeChatDraft(draftKey("user-1", "project-2", "a"), draft, NOW, storage);
  storage.setItem(draftKey("user-1", "project-1", "c"), "{corrompu");
  storage.setItem("autre-cle", "intacte");

  assert.deepEqual(readChatDrafts("user-1", "project-1", NOW, storage), { a: draft });
  // Expiré et corrompu sont supprimés ; le reste du stockage n’est pas touché.
  assert.equal(storage.getItem(draftKey("user-1", "project-1", "b")), null);
  assert.equal(storage.getItem(draftKey("user-1", "project-1", "c")), null);
  assert.ok(storage.getItem(draftKey("user-2", "project-1", "a")));
  assert.equal(storage.getItem("autre-cle"), "intacte");
});

test("clearChatDrafts efface tous les brouillons et seulement eux", async () => {
  const storage = new MemoryStorage();
  const draft = { reply: "", note: "Note", noteMode: true };
  writeChatDraft(draftKey("user-1", "project-1", "a"), draft, NOW, storage);
  writeChatDraft(draftKey("user-2", "project-9", "z"), draft, NOW, storage);
  storage.setItem("theme", "dark");

  await clearChatDrafts(storage);

  assert.equal(storage.length, 1);
  assert.equal(storage.getItem("theme"), "dark");
});
