import { PRICING_PLANS, projectPlanHref, type PlanId } from "./pricing";

// Only relative application URLs may be used as authentication destinations.
export function safeAuthCallback(value: unknown, fallback = "/projects") {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//")
  )
    return fallback;
  try {
    const decoded = decodeURIComponent(value);
    if (/[\\\u0000-\u0020\u007f]/.test(decoded) || decoded.startsWith("//"))
      return fallback;
    const url = new URL(value, "https://app.invalid");
    if (url.origin !== "https://app.invalid" || url.pathname.startsWith("//")) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

// Rebuild checkout intent from the allowlisted plan, never from URL prices/quotas.
export function checkoutCallback(value: unknown): string | undefined {
  const safe = safeAuthCallback(value, "");
  if (!safe) return undefined;
  const url = new URL(safe, "https://app.invalid");
  if (
    url.pathname !== "/projects/new" ||
    url.searchParams.getAll("plan").length !== 1
  )
    return undefined;
  const plan = PRICING_PLANS.find(
    (candidate) => candidate.id === url.searchParams.get("plan"),
  );
  return plan ? projectPlanHref(plan.id) : undefined;
}

export function signUpHref(callback?: unknown) {
  const destination = checkoutCallback(callback);
  return destination
    ? `/sign-up?callbackUrl=${encodeURIComponent(destination)}`
    : "/sign-up";
}

export function signUpPlanHref(plan: PlanId) {
  return signUpHref(projectPlanHref(plan));
}

export function signInAfterSignUpHref(callback?: unknown) {
  const destination = checkoutCallback(callback);
  return destination
    ? `/sign-in?callbackUrl=${encodeURIComponent(destination)}`
    : "/sign-in";
}
