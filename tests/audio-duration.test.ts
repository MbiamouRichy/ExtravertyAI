import assert from "node:assert/strict";
import test from "node:test";
import { resolveAudioDuration } from "../lib/audio-duration";
import { MAX_MEDIA_BYTES } from "../lib/chat-media";

test("audio duration decodes metadata-free media and rejects invalid payloads", async (t) => {
  let calls = 0;
  t.mock.method(
    globalThis,
    "fetch",
    async () => new Response(new Uint8Array([1, 2, 3])),
  );
  const original = Object.getOwnPropertyDescriptor(
    globalThis,
    "OfflineAudioContext",
  );
  Object.defineProperty(globalThis, "OfflineAudioContext", {
    configurable: true,
    value: class {
      async decodeAudioData() {
        calls++;
        return { duration: 7.25 };
      }
    },
  });
  try {
    assert.equal(
      await resolveAudioDuration("blob:audio", new AbortController().signal),
      7.25,
    );
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(
      resolveAudioDuration("blob:audio", controller.signal),
      { name: "AbortError" },
    );
    assert.equal(calls, 1, "cancelled decoding must not start");
    t.mock.method(
      globalThis,
      "fetch",
      async () => new Response(new Uint8Array(MAX_MEDIA_BYTES + 1)),
    );
    await assert.rejects(
      resolveAudioDuration("blob:audio", new AbortController().signal),
      /AUDIO_SIZE/,
    );
    assert.equal(calls, 1, "oversized audio must not be decoded");
  } finally {
    if (original)
      Object.defineProperty(globalThis, "OfflineAudioContext", original);
    else Reflect.deleteProperty(globalThis, "OfflineAudioContext");
  }
});
