import { test } from "node:test";
import assert from "node:assert/strict";
import { bucketKeyFor, bucketLabel, buildBucketKeys } from "../lib/analytics";
import { localDayKey, validTimeZone } from "../lib/user-time-zone";
import { reportRange } from "../lib/weekly-report";

test("validates browser zones and rejects untrusted cookie values", () => {
  assert.ok(validTimeZone("Africa/Libreville"));
  assert.equal(validTimeZone("not-a-zone"), null);
  assert.equal(validTimeZone("x".repeat(101)), null);
  assert.equal(validTimeZone(undefined), null);
});

test("an instant belongs to the user's local day, week and month", () => {
  const date = new Date("2026-03-01T23:30:00Z");
  assert.equal(localDayKey(date, "Africa/Libreville"), "2026-03-02");
  assert.equal(bucketKeyFor(date, "week", "Africa/Libreville"), "2026-03-02");
  assert.equal(bucketKeyFor(date, "week", "America/Los_Angeles"), "2026-02-23");
  assert.equal(
    bucketKeyFor(new Date("2026-01-31T23:45:00Z"), "month", "Asia/Kathmandu"),
    "2026-02",
  );
  assert.equal(
    bucketKeyFor(
      new Date("2026-01-01T00:30:00Z"),
      "day",
      "America/Los_Angeles",
    ),
    "2025-12-31",
  );
});

test("calendar buckets survive spring and autumn clock changes without gaps", () => {
  for (const [start, end, expected] of [
    [
      "2026-03-28T23:00:00Z",
      "2026-03-30T22:00:00Z",
      ["2026-03-29", "2026-03-30"],
    ],
    [
      "2026-10-24T22:00:00Z",
      "2026-10-26T23:00:00Z",
      ["2026-10-25", "2026-10-26"],
    ],
  ] as const) {
    assert.deepEqual(
      buildBucketKeys(new Date(start), new Date(end), "day", "Europe/Paris"),
      expected,
    );
  }
  assert.deepEqual(
    buildBucketKeys(
      new Date("2026-10-01T23:00:00Z"),
      new Date("2026-10-02T23:00:00Z"),
      "day",
      "Africa/Libreville",
    ),
    ["2026-10-02"],
  );
});

test("weekly and monthly buckets use local calendar boundaries", () => {
  assert.deepEqual(
    buildBucketKeys(
      new Date("2026-03-01T23:00:00Z"),
      new Date("2026-03-08T23:00:00Z"),
      "week",
      "Africa/Libreville",
    ),
    ["2026-03-02"],
  );
  assert.deepEqual(
    buildBucketKeys(
      new Date("2026-01-31T23:00:00Z"),
      new Date("2026-02-28T23:00:00Z"),
      "month",
      "Africa/Libreville",
    ),
    ["2026-02"],
  );
  assert.match(bucketLabel("2026-03-02", "day"), /2 mars/);
});

test("report dates render in viewer's timezone without changing stored windows", () => {
  const start = new Date("2026-10-05T00:00:00Z");
  const end = new Date("2026-10-12T00:00:00Z");
  assert.match(reportRange(start, end, "America/Los_Angeles"), /^4 oct/);
  assert.match(reportRange(start, end, "Africa/Libreville"), /^5 oct/);
  assert.equal(start.toISOString(), "2026-10-05T00:00:00.000Z");
});
