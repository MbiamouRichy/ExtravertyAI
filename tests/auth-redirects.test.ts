import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkoutCallback,
  safeAuthCallback,
  signInAfterSignUpHref,
  signUpHref,
  signUpPlanHref,
} from "../lib/auth-redirects";
import { PRICING_PLANS, resolvePlanId } from "../lib/pricing";

const base = "https://example.test";

test("each pricing button preserves the plan through signup, verification and signin", () => {
  for (const plan of PRICING_PLANS) {
    const signup = new URL(signUpPlanHref(plan.id), base);
    assert.equal(signup.pathname, "/sign-up");
    const intent = checkoutCallback(signup.searchParams.get("callbackUrl"));
    const verificationReturn = signInAfterSignUpHref(intent);
    const signin = new URL(verificationReturn, base);
    assert.equal(signin.pathname, "/sign-in");
    const project = new URL(
      safeAuthCallback(signin.searchParams.get("callbackUrl")),
      base,
    );
    assert.equal(project.pathname, "/projects/new");
    assert.equal(resolvePlanId(project.searchParams.get("plan")), plan.id);
    assert.equal(
      signUpHref(project.pathname + project.search),
      signup.pathname + signup.search,
    );
  }
});

test("ordinary or invalid signup callbacks return to signin without checkout intent", () => {
  for (const value of [
    undefined,
    "",
    ["/projects/new?plan=pro"],
    "/projects",
    "/projects/new",
    "/projects/new?plan=unknown",
    "/projects/new?plan=pro&plan=business",
    "https://evil.test/projects/new?plan=pro",
    "//evil.test/projects/new?plan=pro",
  ]) {
    assert.equal(signInAfterSignUpHref(value), "/sign-in");
    assert.equal(signUpHref(value), "/sign-up");
  }
  assert.equal(safeAuthCallback(undefined), "/projects");
});

test("checkout URLs discard prices, quotas and nested redirects", () => {
  assert.equal(
    checkoutCallback(
      "/projects/new?plan=pro&price=1&limit=999999&callbackUrl=https://evil.test#ignored",
    ),
    "/projects/new?plan=pro",
  );
});

test("signin allows local destinations and rejects unsafe redirect targets", () => {
  assert.equal(
    safeAuthCallback("/projects/abc?tab=settings"),
    "/projects/abc?tab=settings",
  );
  for (const value of [
    "javascript:alert(1)",
    "https://evil.test",
    "//evil.test",
    "/foo/..//evil.test",
    "/\\evil.test",
    "/%5cevil.test",
    "/%2fevil.test",
    "/%0a/evil.test",
    "/bad%",
    ["/projects"],
  ]) {
    assert.equal(safeAuthCallback(value), "/projects");
  }
});
