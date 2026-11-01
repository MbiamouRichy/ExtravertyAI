import { test } from "node:test";
import assert from "node:assert/strict";
import {
  jidAliasesFromChats,
  mapProviderPresence,
  parsePresenceUpdate,
} from "../lib/contact-presence-shared";

test("a contact's number and lid are linked from Evolution chats", () => {
  const aliases = jidAliasesFromChats([
    {
      lastMessage: {
        key: {
          remoteJid: "161@lid",
          remoteJidAlt: "24166845029@s.whatsapp.net",
        },
      },
    },
    { lastMessage: { key: { remoteJid: "24100000000@s.whatsapp.net" } } },
    { lastMessage: { key: { remoteJid: "1203@g.us", remoteJidAlt: "1@lid" } } },
    { lastMessage: null },
  ]);
  assert.equal(aliases.get("161@lid"), "24166845029@s.whatsapp.net");
  assert.equal(aliases.get("24166845029@s.whatsapp.net"), "161@lid");
  assert.equal(aliases.size, 2);
  assert.equal(jidAliasesFromChats({ nope: true }).size, 0);
});

test("WhatsApp presence updates map to online, typing and offline", () => {
  assert.equal(mapProviderPresence("available"), "online");
  assert.equal(mapProviderPresence("paused"), "online");
  assert.equal(mapProviderPresence("composing"), "typing");
  assert.equal(mapProviderPresence("recording"), "recording");
  assert.equal(mapProviderPresence("unavailable"), "offline");
  assert.equal(mapProviderPresence("anything"), null);

  assert.deepEqual(
    parsePresenceUpdate({
      id: "24166845039@s.whatsapp.net",
      presences: {
        "24166845039@s.whatsapp.net": { lastKnownPresence: "composing" },
        // Les groupes et états inconnus sont ignorés.
        "1203630@g.us": { lastKnownPresence: "available" },
        "123@lid": { lastKnownPresence: "bizarre" },
      },
    }),
    [{ remoteJid: "24166845039@s.whatsapp.net", presence: "typing" }],
  );
  // Un contact connu sous son numéro peut être signalé par son @lid.
  assert.deepEqual(
    parsePresenceUpdate({
      id: "24166845039@s.whatsapp.net",
      presences: { "123@lid": { lastKnownPresence: "recording" } },
    }),
    [
      { remoteJid: "123@lid", presence: "recording" },
      { remoteJid: "24166845039@s.whatsapp.net", presence: "recording" },
    ],
  );
  assert.deepEqual(parsePresenceUpdate({ nope: true }), []);
});
