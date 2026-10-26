import { test } from "node:test";
import assert from "node:assert/strict";
import { weekdaySlotFor } from "../lib/analytics";

test("heatmap slots follow the user's local timezone", () => {
  // Friday 2 Oct 2026, 23:30 UTC = Saturday 00:30 in Libreville (UTC+1).
  const instant = new Date("2026-10-02T23:30:00Z");
  assert.deepEqual(weekdaySlotFor(instant, "UTC"), { weekday: 4, slot: 11 });
  assert.deepEqual(weekdaySlotFor(instant, "Africa/Libreville"), { weekday: 5, slot: 0 });
});

test("heatmap weeks start on Monday and slots cover two hours", () => {
  assert.deepEqual(weekdaySlotFor(new Date("2026-10-05T09:59:00Z")), { weekday: 0, slot: 4 });
  assert.deepEqual(weekdaySlotFor(new Date("2026-10-11T13:00:00Z")), { weekday: 6, slot: 6 });
});
