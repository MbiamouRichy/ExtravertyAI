import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addMember,
  createProject,
  createUser,
  withTestDatabase,
} from "./helpers/database";
import { checkAdminSession, parseAdminEmails } from "../lib/admin-access";
import {
  AdminFeedbackError,
  feedbackFiltersToSearch,
  listFeedback,
  parseFeedbackFilters,
  UpdateFeedbackSchema,
  updateFeedback,
} from "../lib/admin-feedback";

const ALLOW = " Equipe@Extraverty.test, ops@extraverty.test ,pas-une-adresse";
const session = (
  email: string | null,
  options: { verified?: boolean; createdAt?: Date } = {},
) => ({
  user: {
    id: "u1",
    name: "Équipe",
    email,
    emailVerified: options.verified ?? true,
  },
  session: { createdAt: options.createdAt ?? new Date() },
});

test("only verified, allow-listed e-mails reach the back-office", () => {
  assert.deepEqual(
    [...parseAdminEmails(ALLOW)],
    ["equipe@extraverty.test", "ops@extraverty.test"],
  );
  // Sans liste, personne n'entre.
  assert.equal(parseAdminEmails(undefined).size, 0);
  assert.equal(
    checkAdminSession(session("equipe@extraverty.test"), { allowList: "" }).ok,
    false,
  );

  const allowed = checkAdminSession(session("EQUIPE@extraverty.test"), {
    allowList: ALLOW,
  });
  assert.equal(allowed.ok, true);
  assert.equal(allowed.ok && allowed.admin.email, "equipe@extraverty.test");

  for (const denied of [
    null,
    { user: null, session: null },
    session("client@example.test"),
    session(null),
    // Une adresse non vérifiée ne prouve rien : n'importe qui peut la saisir.
    session("ops@extraverty.test", { verified: false }),
    // Un sous-domaine ou un suffixe ne suffit pas.
    session("ops@extraverty.test.evil.test"),
  ])
    assert.deepEqual(checkAdminSession(denied, { allowList: ALLOW }), {
      ok: false,
      reason: "DENIED",
    });

  // Action sensible : connexion de moins de 10 minutes exigée.
  const old = new Date(Date.now() - 11 * 60 * 1000);
  assert.deepEqual(
    checkAdminSession(session("ops@extraverty.test", { createdAt: old }), {
      allowList: ALLOW,
      recent: true,
    }),
    { ok: false, reason: "REAUTH_REQUIRED" },
  );
  assert.equal(
    checkAdminSession(session("ops@extraverty.test", { createdAt: old }), {
      allowList: ALLOW,
    }).ok,
    true,
  );
});

test("URL filters fall back to safe defaults", () => {
  const filters = parseFeedbackFilters({
    kind: "HACK",
    status: ["DONE", "NEW"],
    period: "9999",
    q: `  ${"x".repeat(300)}  `,
    sort: "asc",
    page: "-3",
  });
  assert.equal(filters.kind, "ALL");
  assert.equal(filters.status, "DONE");
  assert.equal(filters.period, "all");
  assert.equal(filters.q.length, 100);
  assert.equal(filters.sort, "asc");
  assert.equal(filters.page, 1);
  assert.equal(feedbackFiltersToSearch(parseFeedbackFilters({})), "");
  assert.equal(
    feedbackFiltersToSearch({ ...parseFeedbackFilters({}), kind: "BUG", id: "c1" }),
    "?kind=BUG&id=c1",
  );
  assert.equal(
    UpdateFeedbackSchema.safeParse({ id: "x", status: "DONE", internalNote: "" })
      .success,
    false,
  );
});

test(
  "admins filter, triage and audit product feedback",
  { timeout: 600000 },
  async () => {
    await withTestDatabase(async (prisma) => {
      const project = await createProject(prisma);
      const author = await createUser(prisma, "Inès Obame");
      const other = await createUser(prisma, "Paul Ndong");
      await addMember(prisma, project.id, author.id, "OWNER");
      const adminUser = await createUser(prisma, "Équipe");
      const admin = { id: adminUser.id, name: adminUser.name, email: adminUser.email };
      const now = new Date();
      const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000);
      const make = (data: {
        kind: "BUG" | "IDEA" | "PRAISE";
        message: string;
        userId: string;
        createdAt: Date;
        status?: "NEW" | "ARCHIVED";
      }) =>
        prisma.productFeedback.create({
          data: { ...data, projectId: data.userId === author.id ? project.id : null },
        });
      const bug = await make({
        kind: "BUG",
        message: "Le bouton Envoyer ne répond plus",
        userId: author.id,
        createdAt: daysAgo(1),
      });
      await make({
        kind: "IDEA",
        message: "Filtrer les contacts par étiquette",
        userId: other.id,
        createdAt: daysAgo(40),
      });
      await make({
        kind: "PRAISE",
        message: "Merci pour les rapports hebdomadaires",
        userId: other.id,
        createdAt: daysAgo(3),
        status: "ARCHIVED",
      });

      const list = (params: Record<string, string>) =>
        listFeedback(prisma, parseFeedbackFilters(params), now);

      // Par défaut : hors archives, du plus récent au plus ancien.
      const open = await list({});
      assert.deepEqual(
        open.items.map((item) => item.kind),
        ["BUG", "IDEA"],
      );
      assert.equal(open.statusCounts.ARCHIVED, 1);
      assert.deepEqual(open.kindCounts, { BUG: 1, IDEA: 1, PRAISE: 1 });
      assert.deepEqual(
        (await list({ sort: "asc", status: "ALL" })).items.map((i) => i.kind),
        ["IDEA", "PRAISE", "BUG"],
      );
      assert.deepEqual(
        (await list({ status: "ARCHIVED" })).items.map((i) => i.kind),
        ["PRAISE"],
      );
      assert.deepEqual(
        (await list({ kind: "IDEA" })).items.map((i) => i.kind),
        ["IDEA"],
      );
      // Période : les compteurs suivent, pas seulement la liste.
      const recent = await list({ period: "30", status: "ALL" });
      assert.equal(recent.total, 2);
      assert.equal(recent.kindCounts.IDEA, 0);
      // Recherche dans le message, le nom de l'auteur ou le projet, sans casse.
      assert.equal((await list({ q: "BOUTON" })).total, 1);
      assert.equal((await list({ q: "paul" })).total, 1);
      assert.equal((await list({ q: "inexistant" })).total, 0);
      // Les données exposées s'arrêtent au nom et à l'e-mail.
      assert.deepEqual(Object.keys(open.items[0].user ?? {}).sort(), [
        "email",
        "name",
      ]);

      await updateFeedback(prisma, admin, {
        id: bug.id,
        status: "IN_PROGRESS",
        internalNote: "  Reproduit sur Safari  ",
      });
      let row = await prisma.productFeedback.findUniqueOrThrow({ where: { id: bug.id } });
      assert.equal(row.status, "IN_PROGRESS");
      assert.equal(row.internalNote, "Reproduit sur Safari");
      assert.equal(row.handledById, admin.id);
      assert.ok(row.handledAt);

      // Rien ne change : ni écriture ni entrée de journal.
      assert.deepEqual(
        await updateFeedback(prisma, admin, {
          id: bug.id,
          status: "IN_PROGRESS",
          internalNote: "Reproduit sur Safari",
        }),
        { changed: false },
      );
      await updateFeedback(prisma, admin, { id: bug.id, status: "NEW", internalNote: "" });
      row = await prisma.productFeedback.findUniqueOrThrow({ where: { id: bug.id } });
      assert.equal(row.handledAt, null);
      assert.equal(row.internalNote, null);

      const audit = await prisma.adminAuditLog.findMany({ orderBy: { createdAt: "asc" } });
      assert.equal(audit.length, 2);
      assert.equal(audit[0].actorEmail, admin.email);
      assert.equal(audit[0].action, "feedback.update");
      assert.equal(audit[0].targetId, bug.id);
      assert.deepEqual(audit[0].metadata, {
        from: "NEW",
        to: "IN_PROGRESS",
        noteChanged: true,
      });
      // Le contenu de la note n'est jamais recopié dans le journal.
      assert.ok(!JSON.stringify(audit).includes("Safari"));

      await assert.rejects(
        updateFeedback(prisma, admin, {
          id: "c" + "0".repeat(24),
          status: "DONE",
          internalNote: "",
        }),
        AdminFeedbackError,
      );
    });
  },
);
