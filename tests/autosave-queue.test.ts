import { test } from "node:test";
import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import {
  AutosaveQueue,
  type SaveResult,
  type AutosaveStatus,
} from "../lib/autosave-queue";

test("typing saves only the latest value after the pause", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const writes: string[] = [];
  const queue = new AutosaveQueue<string>(
    2,
    async (value) => {
      writes.push(value);
      return { success: true, version: 3 };
    },
    () => {},
  );
  queue.schedule("Premier", 600);
  t.mock.timers.tick(400);
  queue.schedule("Dernier", 600);
  t.mock.timers.tick(599);
  assert.deepEqual(writes, []);
  t.mock.timers.tick(1);
  await setImmediate();
  assert.deepEqual(writes, ["Dernier"]);
  assert.equal(queue.unsaved, false);
});

test("rapid choices are serialized using the acknowledged version", async () => {
  const writes: Array<[string, number]> = [];
  let finish!: (result: SaveResult) => void;
  const queue = new AutosaveQueue<string>(
    4,
    async (value, version) => {
      writes.push([value, version]);
      if (writes.length === 1)
        return new Promise<SaveResult>((resolve) => {
          finish = resolve;
        });
      return { success: true, version: 6 };
    },
    () => {},
  );
  queue.schedule("warm", 0);
  queue.schedule("professional", 0);
  queue.schedule("direct", 0);
  queue.acceptVersion(99);
  assert.deepEqual(writes, [["warm", 4]]);
  finish({ success: true, version: 5 });
  await setImmediate();
  assert.deepEqual(writes, [
    ["warm", 4],
    ["direct", 5],
  ]);
  assert.equal(queue.unsaved, false);
});

test("a pending write never acknowledges newer invalid text", async () => {
  let finish!: (result: SaveResult) => void;
  const statuses: AutosaveStatus[] = [];
  const queue = new AutosaveQueue<string>(
    1,
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
    (status) => statuses.push(status),
  );
  queue.schedule("Valid", 0);
  queue.invalidate();
  finish({ success: true, version: 2 });
  await setImmediate();
  assert.equal(queue.unsaved, true);
  assert.equal(statuses.at(-1), "invalid");
});

test("an unconfirmed write stops the queue and retains unsaved status", async () => {
  let finish!: (result: SaveResult) => void;
  const writes: string[] = [];
  const statuses: AutosaveStatus[] = [];
  const queue = new AutosaveQueue<string>(
    1,
    (value) => {
      writes.push(value);
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
    (status) => statuses.push(status),
  );
  queue.schedule("First", 0);
  queue.schedule("Latest", 0);
  finish({ success: false, error: "Version conflict" });
  await setImmediate();
  assert.deepEqual(writes, ["First"]);
  assert.equal(queue.unsaved, true);
  assert.equal(statuses.at(-1), "error");
});

test("flush saves pending text without waiting for the debounce", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const writes: string[] = [];
  const queue = new AutosaveQueue<string>(
    1,
    async (value) => {
      writes.push(value);
      return { success: true, version: 2 };
    },
    () => {},
  );
  queue.schedule("Pending", 600);
  await queue.flush();
  t.mock.timers.tick(1000);
  assert.deepEqual(writes, ["Pending"]);
});
