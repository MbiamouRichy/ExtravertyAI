import { test } from "node:test";
import assert from "node:assert/strict";
import { createUser, withTestDatabase } from "./helpers/database";
import {
  getHelpFeedbackDetail,
  HelpFeedbackError,
  helpFeedbackVisitorHash,
  listHelpFeedback,
  parseHelpFeedbackFilters,
  recordHelpFeedback,
  updateHelpFeedback,
} from "../lib/help-feedback";
import { helpFeedbackFiltersToSearch } from "../lib/help-center/feedback-shared";

const vote = (articleSlug: string, helpful: boolean, extra: { reason?: "UNCLEAR" | "MISSING_STEP"; comment?: string } = {}) => ({
  articleSlug,
  helpful,
  reason: helpful ? null : (extra.reason ?? null),
  comment: helpful ? null : (extra.comment ?? null),
});

test("the visitor fingerprint changes every day and never contains the IP", () => {
  const visitor = { ip: "203.0.113.7", userAgent: "Mozilla/5.0" };
  const day1 = helpFeedbackVisitorHash("secret", visitor, new Date("2026-11-22T10:00:00Z"));
  const sameDay = helpFeedbackVisitorHash("secret", visitor, new Date("2026-11-22T23:00:00Z"));
  const day2 = helpFeedbackVisitorHash("secret", visitor, new Date("2026-11-23T10:00:00Z"));
  assert.equal(day1, sameDay);
  assert.notEqual(day1, day2);
  assert.doesNotMatch(day1, /203/);
  // Un compte connecté garde la même empreinte, quelle que soit son adresse IP.
  assert.equal(
    helpFeedbackVisitorHash("secret", { userId: "u1", ip: "1.1.1.1", userAgent: "a" }),
    helpFeedbackVisitorHash("secret", { userId: "u1", ip: "2.2.2.2", userAgent: "b" }),
  );
});

test("admin filters fall back to defaults and stay short in URLs", () => {
  assert.deepEqual(parseHelpFeedbackFilters({ vote: "PIRATE", article: "inconnu", period: "9999", page: "-3" }), {
    vote: "ALL",
    status: "OPEN",
    article: "ALL",
    period: "30",
    comments: "all",
    page: 1,
  });
  const filters = parseHelpFeedbackFilters({ vote: "DOWN", article: "demarrer" });
  assert.equal(helpFeedbackFiltersToSearch(filters), "?vote=DOWN&article=demarrer");
  assert.equal(helpFeedbackFiltersToSearch({ ...filters, vote: "ALL", article: "ALL" }), "");
});

test("one vote per visitor and article: a new click replaces it and reopens it", async () => {
  await withTestDatabase(async (prisma) => {
    const visitor = { visitorHash: "hash-a", userId: null };
    assert.deepEqual(await recordHelpFeedback(prisma, vote("demarrer", true), visitor), { created: true });
    // Même vote : rien ne change.
    assert.deepEqual(await recordHelpFeedback(prisma, vote("demarrer", true), visitor), { created: false });
    assert.equal(await prisma.helpFeedback.count(), 1);

    const adminUser = await createUser(prisma, "Équipe");
    const admin = { id: adminUser.id, name: adminUser.name, email: adminUser.email };
    const row = await prisma.helpFeedback.findFirstOrThrow();
    await updateHelpFeedback(prisma, admin, { id: row.id, status: "DONE", internalNote: "Vu" });

    // Le visiteur change d’avis et précise : l’avis redevient à traiter, la note reste.
    await recordHelpFeedback(prisma, vote("demarrer", false, { reason: "MISSING_STEP", comment: "Étape 5 floue" }), visitor);
    const updated = await prisma.helpFeedback.findFirstOrThrow();
    assert.equal(await prisma.helpFeedback.count(), 1);
    assert.equal(updated.helpful, false);
    assert.equal(updated.reason, "MISSING_STEP");
    assert.equal(updated.comment, "Étape 5 floue");
    assert.equal(updated.status, "NEW");
    assert.equal(updated.handledById, null);
    assert.equal(updated.internalNote, "Vu");

    // Un autre visiteur, ou un autre article, compte à part.
    await recordHelpFeedback(prisma, vote("demarrer", true), { visitorHash: "hash-b", userId: null });
    await recordHelpFeedback(prisma, vote("forfaits", false), visitor);
    assert.equal(await prisma.helpFeedback.count(), 3);

    await assert.rejects(recordHelpFeedback(prisma, vote("inconnu", true), visitor), HelpFeedbackError);
  });
});

test("the database refuses a positive vote with a comment or an invalid slug", async () => {
  await withTestDatabase(async (prisma) => {
    await assert.rejects(
      prisma.helpFeedback.create({
        data: { articleSlug: "demarrer", helpful: true, comment: "non", visitorHash: "h" },
      }),
    );
    await assert.rejects(
      prisma.helpFeedback.create({ data: { articleSlug: "../x", helpful: false, visitorHash: "h" } }),
    );
  });
});

test("the back-office lists votes, scores articles and journals every change", async () => {
  await withTestDatabase(async (prisma) => {
    const reader = await createUser(prisma, "Inès Obame");
    const adminUser = await createUser(prisma, "Équipe");
    const admin = { id: adminUser.id, name: adminUser.name, email: adminUser.email };
    await recordHelpFeedback(prisma, vote("demarrer", true), { visitorHash: "a", userId: null });
    await recordHelpFeedback(prisma, vote("demarrer", true), { visitorHash: "b", userId: null });
    await recordHelpFeedback(prisma, vote("demarrer", false, { reason: "UNCLEAR", comment: "QR illisible" }), {
      visitorHash: "c",
      userId: reader.id,
    });
    await recordHelpFeedback(prisma, vote("forfaits", false), { visitorHash: "a", userId: null });
    // Un vote ancien sort de la période par défaut (30 jours).
    await prisma.helpFeedback.create({
      data: { articleSlug: "compte", helpful: false, visitorHash: "old", createdAt: new Date(Date.now() - 60 * 86_400_000) },
    });

    const all = await listHelpFeedback(prisma, parseHelpFeedbackFilters({}));
    assert.equal(all.total, 4);
    assert.deepEqual(all.totals, { up: 2, down: 2, score: 0.5 });
    const guide = all.articles.find((article) => article.slug === "demarrer")!;
    assert.equal(guide.up, 2);
    assert.equal(guide.down, 1);
    assert.equal(guide.pending, 1);
    assert.ok(Math.abs((guide.score ?? 0) - 2 / 3) < 1e-9);
    assert.equal(all.articles.some((article) => article.slug === "compte"), false);

    const negative = await listHelpFeedback(prisma, parseHelpFeedbackFilters({ vote: "DOWN", comments: "with" }));
    assert.equal(negative.total, 1);
    const [item] = negative.items;
    assert.equal(item.comment, "QR illisible");
    // Jamais d’empreinte de visiteur dans ce que voit le back-office.
    assert.equal("visitorHash" in item, false);

    const detail = await getHelpFeedbackDetail(prisma, item.id);
    assert.equal(detail?.user?.name, "Inès Obame");
    assert.equal(await getHelpFeedbackDetail(prisma, "pas-un-id"), null);

    assert.deepEqual(await updateHelpFeedback(prisma, admin, { id: item.id, status: "ARCHIVED", internalNote: "Corrigé" }), {
      changed: true,
    });
    assert.deepEqual(await updateHelpFeedback(prisma, admin, { id: item.id, status: "ARCHIVED", internalNote: "Corrigé" }), {
      changed: false,
    });
    const archived = await prisma.helpFeedback.findUniqueOrThrow({ where: { id: item.id } });
    assert.equal(archived.handledById, adminUser.id);
    assert.ok(archived.handledAt);
    const audit = await prisma.adminAuditLog.findMany({ where: { targetId: item.id } });
    assert.equal(audit.length, 1);
    assert.equal(audit[0].action, "help_feedback.update");
    // Le texte de la note n’entre pas dans le journal.
    assert.doesNotMatch(JSON.stringify(audit[0].metadata), /Corrigé/);

    const open = await listHelpFeedback(prisma, parseHelpFeedbackFilters({}));
    assert.equal(open.total, 3);
    assert.equal(open.statusCounts.ARCHIVED, 1);

    await assert.rejects(
      updateHelpFeedback(prisma, admin, { id: "c00000000000000000000000", status: "DONE", internalNote: "" }),
      HelpFeedbackError,
    );
  });
});
