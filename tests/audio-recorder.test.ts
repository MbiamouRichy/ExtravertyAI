import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
function setup(deferred = false) {
  const effects: (() => void)[] = [];
  const files: File[] = [];
  const errors: string[] = [];
  let stopped = 0;
  let acquired = 0;
  let resolve!: (stream: unknown) => void;
  const stream = { getTracks: () => [{ stop: () => stopped++ }] };
  class Recorder {
    static latest: Recorder;
    static isTypeSupported() {
      return true;
    }
    state = "inactive";
    onstop?: () => void;
    ondataavailable?: (e: { data: Blob }) => void;
    onerror?: () => void;
    constructor() {
      Recorder.latest = this;
    }
    start() {
      this.state = "recording";
    }
    stop() {
      this.state = "inactive";
      this.ondataavailable?.({ data: new Blob(["audio"]) });
      this.onstop?.();
    }
  }
  const modules: Record<string, unknown> = {
    react: {
      useRef: (current: unknown) => ({ current }),
      useState: (initial: unknown) => [initial, () => {}],
      useEffect: (fn: () => void | (() => void)) => {
        const cleanup = fn();
        if (cleanup) effects.push(cleanup);
      },
    },
    sonner: { toast: { error: (s: string) => errors.push(s) } },
    "@/lib/chat-media": { MAX_MEDIA_BYTES: 4 * 1024 * 1024 },
  };
  const exports: Record<
    string,
    (
      callback: (f: File) => void,
      scope: string,
    ) => { start: () => Promise<void>; stop: () => void; cancel: () => void }
  > = {};
  const source = ts.transpileModule(
    readFileSync("hooks/use-audio-recorder.ts", "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
      },
    },
  ).outputText;
  runInNewContext(source, {
    exports,
    require: (name: string) => modules[name],
    File,
    Blob,
    DOMException,
    Date,
    MediaRecorder: Recorder,
    navigator: {
      mediaDevices: {
        getUserMedia: () => {
          acquired++;
          return deferred
            ? new Promise((r) => {
                resolve = r;
              })
            : Promise.resolve(stream);
        },
      },
    },
    setInterval: () => 1,
    clearInterval: () => {},
  });
  const hook = exports.useAudioRecorder((f) => files.push(f), "contact");
  return {
    hook,
    files,
    errors,
    stopped: () => stopped,
    acquired: () => acquired,
    resolve: () => resolve(stream),
    cleanup: () => effects.forEach((fn) => fn()),
  };
}
test("recording releases the microphone and creates a preview file only after stop", async () => {
  const s = setup();
  await s.hook.start();
  assert.equal(s.files.length, 0);
  s.hook.stop();
  assert.equal(s.files.length, 1);
  assert.equal(s.files[0].type, "audio/webm");
  assert.equal(s.stopped(), 1);
});
test("cancel and conversation cleanup discard recording without uploading", async () => {
  for (const cleanup of [false, true]) {
    const s = setup();
    await s.hook.start();
    if (cleanup) s.cleanup();
    else s.hook.cancel();
    assert.equal(s.files.length, 0);
    assert.equal(s.stopped(), 1);
  }
});
test("cancel while permission is pending releases the eventual stream and prevents duplicate prompts", async () => {
  const s = setup(true);
  const pending = s.hook.start();
  await s.hook.start();
  assert.equal(s.acquired(), 1);
  s.hook.cancel();
  s.resolve();
  await pending;
  assert.equal(s.files.length, 0);
  assert.equal(s.stopped(), 1);
});
