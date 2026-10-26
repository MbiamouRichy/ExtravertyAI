import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addMember,
  createProject,
  createUser,
  ingestText,
  withTestDatabase,
} from "./helpers/database";
import {
  classifyUserAgent,
  countryFromHeader,
  isBot,
  normalizePath,
  recordPageView,
  referrerHost,
  visitorHash,
} from "../lib/site-analytics";
import {
  bucketRevenue,
  dashboardPeriod,
  delta,
  estimateRevenue,
  loadDashboard,
  subscriptionFlows,
  type BillingPeriodRow,
} from "../lib/admin-dashboard";

const CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

test("page views keep no identifier, no query and no internal traffic", () => {
  assert.equal(
    normalizePath("/projects/cmh1a2b3c4d5e6f7g8h9i0j1k/chat?token=secret#x"),
    "/projects/:id/chat",
  );
  assert.equal(normalizePath("/Tarifs"), "/tarifs");
  for (const ignored of ["/admin", "/admin/feedback", "/api/pv", "//evil.test", "javascript:alert(1)", "/<script>"])
    assert.equal(normalizePath(ignored), null);

  assert.equal(referrerHost("https://www.Google.com/search?q=extraverty", "extravertyai.com"), "google.com");
  assert.equal(referrerHost("https://extravertyai.com/tarifs", "www.extravertyai.com"), null);
  assert.equal(referrerHost("android-app://com.whatsapp", null), null);
  assert.equal(referrerHost("pas une url", null), null);

  assert.equal(isBot("Googlebot/2.1 (+http://www.google.com/bot.html)"), true);
  assert.equal(isBot(""), true);
  assert.equal(isBot(CHROME), false);
  assert.deepEqual(classifyUserAgent(CHROME), { browser: "Chrome", device: "desktop" });
  assert.deepEqual(classifyUserAgent(IPHONE), { browser: "Safari", device: "mobile" });
  assert.equal(countryFromHeader("GA"), "GA");
  assert.equal(countryFromHeader("XX"), null);
  assert.equal(countryFromHeader("gabon"), null);

  // Même visiteur le même jour, empreinte différente le lendemain ; jamais l'IP en clair.
  const day = new Date("2026-10-26T10:00:00Z");
  const hash = visitorHash("secret", "41.158.0.1", CHROME, day);
  assert.equal(hash, visitorHash("secret", "41.158.0.1", CHROME, new Date("2026-10-26T23:00:00Z")));
  assert.notEqual(hash, visitorHash("secret", "41.158.0.1", CHROME, new Date("2026-10-27T01:00:00Z")));
  assert.ok(!hash.includes("41.158"));
});

const NOW = new Date("2026-10-26T12:00:00Z");
const at = (iso: string) => new Date(`${iso}T00:00:00Z`);

test("renewals, churn and trial conversions come from billing periods", () => {
  const period = dashboardPeriod("12m", NOW);
  assert.equal(period.keys.length, 12);
  assert.equal(period.keys[0], "2025-11-01");
  assert.equal(period.keys[11], "2026-10-01");
  assert.equal(dashboardPeriod("30d", NOW).keys.at(-1), "2026-10-26");

  const cycle = (projectId: string, start: string, end: string, limit = 4000): BillingPeriodRow => ({
    projectId,
    key: `cycle:sub_${projectId}:${start}`,
    startsAt: at(start),
    endsAt: at(end),
    limit,
  });
  const periods: BillingPeriodRow[] = [
    // A renouvelle en août puis en septembre.
    cycle("A", "2026-07-10", "2026-08-10"),
    cycle("A", "2026-08-10", "2026-09-10"),
    cycle("A", "2026-09-10", "2026-11-10"),
    // B paie avec 5 jours de retard : renouvelé quand même.
    cycle("B", "2026-08-01", "2026-09-01"),
    cycle("B", "2026-09-06", "2026-12-06"),
    // C part en septembre : désabonnement.
    cycle("C", "2026-08-15", "2026-09-15", 10000),
    // D : échéance d'hier, paiement peut-être en cours, pas encore compté.
    cycle("D", "2026-09-25", "2026-10-25"),
    // Essais : E convertit avant la fin, F non.
    { projectId: "E", key: "trial:sub_E", startsAt: at("2026-09-01"), endsAt: at("2026-09-08"), limit: 150 },
    cycle("E", "2026-09-05", "2026-11-05"),
    { projectId: "F", key: "trial:sub_F", startsAt: at("2026-09-01"), endsAt: at("2026-09-08"), limit: 150 },
  ];
  const flows = subscriptionFlows(periods, period);
  const sept = flows.series.find((point) => point.key === "2026-09-01")!;
  assert.deepEqual(
    { due: sept.due, renewed: sept.renewed, churned: sept.churned, trials: sept.trials, converted: sept.converted },
    { due: 3, renewed: 2, churned: 1, trials: 2, converted: 1 },
  );
  assert.equal(flows.series.find((point) => point.key === "2026-08-01")!.renewalRate, 1);
  assert.equal(flows.series.find((point) => point.key === "2026-10-01")!.due, 0);
  assert.equal(flows.churned, 1);
  assert.equal(flows.renewalRate, 3 / 4);

  // Estimation : prix catalogue selon la limite de messages de l'offre.
  const estimate = estimateRevenue(periods, period);
  assert.equal(estimate.series.find((point) => point.key === "2026-08-01")!.value, 15.99 * 2 + 39.99);

  assert.equal(delta(150, 100), 0.5);
  assert.equal(delta(0, 0), 0);
  assert.equal(delta(5, 0), null);
});

test("revenue is summed in the main currency, zero-decimal aware", () => {
  const period = dashboardPeriod("12m", NOW);
  const revenue = bucketRevenue(
    [
      { amount: 1_000_000, currency: "xaf", paidAt: at("2026-10-02") },
      { amount: 500_000, currency: "xaf", paidAt: at("2026-09-02") },
      { amount: 250_000, currency: "xaf", paidAt: at("2025-03-02") },
      { amount: 3999, currency: "usd", paidAt: at("2026-10-03") },
    ],
    period,
  );
  assert.equal(revenue.currency, "XAF");
  assert.equal(revenue.current, 1_500_000);
  assert.equal(revenue.previous, 250_000);
  assert.deepEqual(revenue.otherCurrencies, ["USD"]);
  assert.equal(revenue.series.at(-1)!.value, 1_000_000);
});

test(
  "dashboard aggregates users, projects, audience and messages per plan",
  { timeout: 600000 },
  async () => {
    await withTestDatabase(async (prisma) => {
      const now = new Date();
      const project = await createProject(prisma, { plan: "pro" });
      const owner = await createUser(prisma, "Inès");
      await addMember(prisma, project.id, owner.id, "OWNER");
      // Un compte d'il y a 3 ans : compté dans le total, pas sur la période.
      const old = await createUser(prisma, "Ancien");
      await prisma.user.update({
        where: { id: old.id },
        data: { createdAt: new Date(now.getTime() - 3 * 365 * 86_400_000) },
      });
      await ingestText(prisma, project.id, "Bonjour");
      await ingestText(prisma, project.id, "Vous êtes ouverts ?");

      const view = (hash: string, path: string, extra: Partial<{ country: string; browser: string; device: string; referrerHost: string }> = {}) =>
        recordPageView(prisma, {
          visitorHash: hash,
          path,
          country: extra.country ?? "GA",
          browser: extra.browser ?? "Chrome",
          device: extra.device ?? "mobile",
          referrerHost: extra.referrerHost ?? null,
        });
      await view("v1", "/", { referrerHost: "google.com" });
      await view("v1", "/tarifs");
      await view("v2", "/", { country: "CM", browser: "Safari", device: "desktop" });
      await view("v3", "/tarifs", { country: "FR" });

      const data = await loadDashboard(prisma, "30d", now);
      assert.equal(data.users.total, 2);
      assert.equal(data.users.current, 1);
      assert.equal(data.projects.current, 1);
      assert.equal(data.users.series.at(-1)!.value, 1);
      assert.equal(data.visitors.current, 3);
      assert.equal(data.visitors.online, 3);
      assert.equal(data.visitors.views.at(-1)!.value, 4);
      // Pays : visiteurs uniques (v1 vu deux fois ne compte qu’une fois).
      assert.deepEqual(data.countries.map((row) => [row.label, row.value]), [["CM", 1], ["FR", 1], ["GA", 1]]);
      assert.deepEqual(data.pages.map((row) => [row.label, row.value]), [["/", 2], ["/tarifs", 2]]);
      assert.deepEqual(data.browsers.map((row) => row.label), ["Chrome", "Safari"]);
      assert.deepEqual(data.referrers, [{ label: "google.com", value: 1, share: 1 }]);
      assert.equal(data.conversion.at(-1)!.rate, 1 / 3);
      // Deux messages, un projet Pro actif : moyenne de 2.
      assert.equal(data.messages.at(-1)!.pro, 2);
      assert.equal(data.messages.at(-1)!.starter, 0);
    });
  },
);
