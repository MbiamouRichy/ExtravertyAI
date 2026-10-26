import { test } from "node:test";
import assert from "node:assert/strict";
import { classify, median, quantile, wilson } from "../lib/report-signal";
import { buildVerdict } from "../lib/report-findings";
import { readIndicators } from "../lib/report-indicators";
import { emptyWeek, isoWeek, type WeekAggregate } from "../lib/report-week";

const WEEK = 7 * 86_400_000;

test("median, quantile and Wilson interval match hand-computed values", () => {
  assert.equal(median([4, 1, 3, 2]), 2.5);
  // percentile_cont(0.9) sur 1..4 : 1 + 0,9 × 3 = 3,7.
  assert.ok(Math.abs(quantile([1, 2, 3, 4], 0.9) - 3.7) < 1e-9);
  // 18 sur 40 : centre 0,4543, demi-largeur 0,1473.
  const { low, high } = wilson(18, 40);
  assert.ok(Math.abs(low - 0.307) < 0.001);
  assert.ok(Math.abs(high - 0.6017) < 0.001);
  assert.deepEqual(wilson(0, 0), { low: 0, high: 1 });
  assert.ok(wilson(0, 10).low === 0 && wilson(10, 10).high === 1);
});

test("a count only becomes unusual outside its band and above the sample floor", () => {
  const calm = [0, 1, 0, 2, 1, 0, 1, 0].map((value) => ({ value, n: value }));
  // Médiane 0,5 ; bande = 0,5 ± 3 × √1 → [0 ; 3,5].
  assert.equal(
    classify(calm, { value: 9, n: 9 }, "count", "down", 5).status,
    "unusual-bad",
  );
  // 3 échecs : sous le seuil de 5, affiché en écart absolu.
  assert.equal(
    classify(calm, { value: 3, n: 3 }, "count", "down", 5).status,
    "low-sample",
  );
  assert.equal(
    classify(calm.slice(0, 3), { value: 9, n: 9 }, "count", "down", 5).status,
    "insufficient-history",
  );
  assert.equal(
    classify(calm, { value: null, n: 0 }, "count", "down", 5).status,
    "not-measured",
  );
});

test("a rate needs 20 conversations and ignores small baseline weeks", () => {
  const usual = [0.7, 0.72, 0.68, 0.71, 0.69, 0.7, 0.73, 0.7].map((value) => ({
    value,
    n: 40,
  }));
  // Bruit binomial à n = 40 : σ = √(0,7 × 0,3 / 40) ≈ 0,072 → bande ≈ [0,48 ; 0,92].
  assert.equal(
    classify(usual, { value: 0.55, n: 40 }, "rate", "up", 20).status,
    "usual",
  );
  assert.equal(
    classify(usual, { value: 0.45, n: 40 }, "rate", "up", 20).status,
    "unusual-bad",
  );
  assert.equal(
    classify(usual, { value: 0.2, n: 12 }, "rate", "up", 20).status,
    "low-sample",
  );
  const sparse = usual.map((week, i) => (i < 5 ? { ...week, n: 8 } : week));
  assert.equal(
    classify(sparse, { value: 0.45, n: 40 }, "rate", "up", 20).status,
    "insufficient-history",
  );
});

test("ISO weeks across the year change, and invariants of a read week", () => {
  assert.equal(isoWeek(new Date("2026-12-28Z")), 53);
  assert.equal(isoWeek(new Date("2027-01-04Z")), 1);
  assert.equal(isoWeek(new Date("2027-01-03Z")), 53);

  const start = Date.UTC(2026, 9, 12);
  const weeks: WeekAggregate[] = Array.from({ length: 10 }, (_, i) => {
    const week = emptyWeek({
      weekStart: new Date(start - (9 - i) * WEEK),
      weekEnd: new Date(start - (8 - i) * WEEK),
    });
    return {
      ...week,
      conversations: 40,
      outcome: {
        failed: 0,
        handover: 8,
        gap: 2,
        unanswered: 1,
        autonomous: 29,
      },
      aiReply: { n: 30, median: 30, p90: 90 },
    };
  });
  for (const reading of readIndicators(weeks, 9)) {
    const { value } = reading.current;
    if (reading.definition.kind === "rate")
      assert.ok(value !== null && value >= 0 && value <= 1);
  }
  const verdict = buildVerdict(readIndicators(weeks, 9), weeks[9]);
  assert.equal(verdict.tone, "usual");
  assert.equal(
    buildVerdict(readIndicators(weeks.slice(0, 2), 1), weeks[1]).tone,
    "new",
  );
  assert.equal(
    buildVerdict(readIndicators([emptyWeek(weeks[0])], 0), emptyWeek(weeks[0]))
      .tone,
    "empty",
  );
});
