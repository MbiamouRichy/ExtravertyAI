import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ANALYTICS_PERIOD_OPTIONS,
  analyticsPeriodAllowed,
  clampAnalyticsPeriod,
} from "../lib/analytics";
import { planFeatures } from "../lib/plan-features";

test("analytics history follows the plan advertised on the pricing page", () => {
  assert.equal(planFeatures("starter").analyticsDays, 30);
  assert.equal(planFeatures("pro").analyticsDays, 90);
  assert.equal(planFeatures("business").analyticsDays, 365);

  const visible = (plan: string) =>
    ANALYTICS_PERIOD_OPTIONS.filter((option) =>
      analyticsPeriodAllowed(option.value, planFeatures(plan).analyticsDays),
    ).map((option) => option.value);

  assert.deepEqual(visible("starter"), ["7d", "14d", "21d", "30d"]);
  assert.deepEqual(visible("pro"), ["7d", "14d", "21d", "30d", "3m"]);
  assert.equal(visible("business").length, ANALYTICS_PERIOD_OPTIONS.length);
});

test("an out-of-plan period from the URL falls back to the longest allowed", () => {
  assert.equal(clampAnalyticsPeriod("1y", 30), "30d");
  assert.equal(clampAnalyticsPeriod("6m", 90), "3m");
  assert.equal(clampAnalyticsPeriod("14d", 30), "14d");
  assert.equal(clampAnalyticsPeriod("1y", 365), "1y");
});
