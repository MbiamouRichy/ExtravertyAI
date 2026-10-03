import { test } from "node:test";
import assert from "node:assert/strict";
import { createChatDateFormatters } from "../lib/chat-dates";

test("chat time and day separators follow the selected local timezone", () => {
  const local = createChatDateFormatters("Africa/Libreville");
  const instant = new Date("2026-10-02T23:30:00Z");
  assert.equal(local.timeFormatter.format(instant), "00:30");
  assert.equal(local.dateFormatter.format(instant), "3 octobre 2026");
  assert.equal(local.dateFormatter.format(instant), local.dateFormatter.format(new Date("2026-10-03T00:30:00Z")));
  const newYork = createChatDateFormatters("America/New_York");
  assert.equal(newYork.timeFormatter.format(new Date("2026-07-01T12:00:00Z")), "08:00");
  assert.equal(newYork.timeFormatter.format(new Date("2026-01-01T12:00:00Z")), "07:00");
});
