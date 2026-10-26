import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mapProviderPresence,
  parsePresenceUpdate,
} from "../lib/contact-presence-shared";

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
  assert.deepEqual(parsePresenceUpdate({ nope: true }), []);
});
