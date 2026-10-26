import { test } from "node:test";
import assert from "node:assert/strict";
import {
  responseTimeSeries,
  formatResponseTime,
} from "../lib/ai-response-metrics";
test("response metrics preserve sub-minute replies, local dates and missing days", () => {
  const now = "2026-10-06T10:00:00Z";
  const rows = responseTimeSeries(
    [
      { receivedAt: "2026-10-05T23:59:00Z", sentAt: "2026-10-05T23:59:02Z" },
      { receivedAt: "2026-10-06T01:00:00Z", sentAt: "2026-10-06T01:00:04Z" },
    ],
    now,
    "Africa/Libreville",
  );
  assert.equal(rows.length, 7);
  assert.equal(rows[6].date, "2026-10-06");
  assert.equal(rows[6].seconds, 3);
  assert.equal(rows[6].count, 2);
  assert.equal(rows[5].seconds, null);
  assert.equal(formatResponseTime(2), "2 s");
  assert.equal(formatResponseTime(0.2), "< 1 s");
});
test("response metrics discard future and invalid durations and preserve genuine zero", () => {
  const now = "2026-10-06T10:00:00Z";
  const rows = responseTimeSeries(
    [
      { receivedAt: now, sentAt: now },
      { receivedAt: now, sentAt: "2026-10-06T10:01:00Z" },
      { receivedAt: now, sentAt: "2026-10-06T09:00:00Z" },
    ],
    now,
    "UTC",
  );
  assert.equal(rows[6].count, 1);
  assert.equal(rows[6].seconds, 0);
});
