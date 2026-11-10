/**
 * Matrice offre × rôle × fonction, vérifiée par appel serveur direct : chaque
 * cas appelle la fonction serveur que l’action utilise, sans passer par
 * l’interface. Les offres attendues sont écrites ici à la main, d’après la
 * grille tarifaire publiée : le test échoue si le code s’en écarte.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

process.env.INTEGRATIONS_ENCRYPTION_KEY ??= randomBytes(32).toString("base64");
process.env.BETTER_AUTH_SECRET ??= "test-secret-for-state-signing";

import type { PrismaClient } from "../src/generated/prisma/client";
import { PROJECT_ROLES, type ProjectRole } from "../lib/project-permissions";
import type { PlanId } from "../lib/pricing";
import { saveFollowUpSettings } from "../lib/follow-ups";
import { setTeamAutoAssign } from "../lib/team-auto-assign";
import { writeReportSettings } from "../lib/report-settings";
import { setCsatSettings } from "../lib/csat";
import { createWebhook } from "../lib/integrations";
import { setProjectCurrency } from "../lib/pipeline";
import { estimateAudience } from "../lib/broadcasts";
import { reserveMessageQuota } from "../lib/message-quota";
import {
  activateBilling,
  addMember,
  createProject,
  createUser,
  withTestDatabase,
} from "./helpers/database";

const PLANS: PlanId[] = ["starter", "pro", "business"];
const MANAGERS: ProjectRole[] = ["OWNER", "ADMIN"];

type Call = (prisma: PrismaClient, projectId: string, userId: string) => Promise<unknown>;

/** Offres qui incluent la fonction selon la grille tarifaire, et l’appel serveur qui l’active. */
const FEATURES: Array<{ name: string; plans: PlanId[]; call: Call }> = [
  {
    name: "Relances automatiques",
    plans: ["business"],
    call: (prisma, projectId, userId) =>
      saveFollowUpSettings(prisma, {
        projectId,
        userId,
        settings: { enabled: true, interestedDays: 2, quoteDays: 0, max: 1, template: "" },
      }),
  },
  {
    name: "Répartition automatique",
    plans: ["business"],
    call: (prisma, projectId, userId) =>
      setTeamAutoAssign(prisma, { projectId, userId, enabled: true }),
  },
  {
    name: "Rapports programmés",
    plans: ["business"],
    call: async (prisma, projectId, userId) => {
      const { reportsVersion } = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
      return prisma.$transaction((tx) =>
        writeReportSettings(tx, projectId, userId, reportsVersion, {
          reportsEnabled: true,
          reportsSkipEmpty: true,
          reportsIncludeTips: true,
          reportsHourUtc: 8,
        }),
      );
    },
  },
  {
    name: "Questionnaire de satisfaction",
    plans: ["pro", "business"],
    call: (prisma, projectId, userId) =>
      setCsatSettings(prisma, { projectId, userId, enabled: true, message: "Notez notre échange de 1 à 5." }),
  },
  {
    name: "Webhooks",
    plans: ["pro", "business"],
    call: (prisma, projectId, userId) =>
      createWebhook(prisma, {
        projectId,
        userId,
        name: "CRM",
        url: "https://example.com/hook",
        events: ["contact.created"],
      }),
  },
  {
    name: "Pipeline de prospects",
    plans: ["business"],
    call: (prisma, projectId, userId) =>
      setProjectCurrency(prisma, { projectId, userId, currency: "XAF" }),
  },
  {
    name: "Diffusion de messages",
    plans: ["pro", "business"],
    call: (prisma, projectId, userId) =>
      estimateAudience(prisma, { projectId, userId, audience: {} }),
  },
];

async function seedProject(prisma: PrismaClient, plan: PlanId) {
  const project = await createProject(prisma, { plan });
  await activateBilling(prisma, project.id);
  return project;
}

async function outcome(run: () => Promise<unknown>) {
  try {
    await run();
    return "autorisé";
  } catch {
    return "refusé";
  }
}

test("offre × rôle × fonction : seul ce que la grille vend est accessible, aux seuls gestionnaires", async () => {
  await withTestDatabase(async (prisma) => {
    const failures: string[] = [];
    for (const plan of PLANS) {
      for (const role of PROJECT_ROLES) {
        for (const feature of FEATURES) {
          // Projet neuf à chaque cas : un réglage déjà actif ne masque aucun refus.
          const project = await seedProject(prisma, plan);
          const user = await createUser(prisma, role);
          await addMember(prisma, project.id, user.id, role);
          const expected =
            feature.plans.includes(plan) && MANAGERS.includes(role) ? "autorisé" : "refusé";
          const actual = await outcome(() => feature.call(prisma, project.id, user.id));
          if (actual !== expected)
            failures.push(`${feature.name} · ${plan} · ${role} : attendu ${expected}, obtenu ${actual}`);
        }
      }
    }
    assert.deepEqual(failures, []);
  });
});

test("d’un projet à l’autre : le propriétaire d’un projet Business n’agit jamais sur celui d’un autre", async () => {
  await withTestDatabase(async (prisma) => {
    const mine = await seedProject(prisma, "business");
    const theirs = await seedProject(prisma, "business");
    const owner = await createUser(prisma, "Propriétaire A");
    await addMember(prisma, mine.id, owner.id, "OWNER");
    const other = await createUser(prisma, "Propriétaire B");
    await addMember(prisma, theirs.id, other.id, "OWNER");
    // Désactivée au départ : une écriture réussie chez l’autre se verrait.
    await prisma.project.update({ where: { id: theirs.id }, data: { autoAssignTeam: false } });
    const before = await prisma.project.findUniqueOrThrow({ where: { id: theirs.id } });
    for (const feature of FEATURES) {
      assert.equal(await outcome(() => feature.call(prisma, mine.id, owner.id)), "autorisé", feature.name);
      assert.equal(await outcome(() => feature.call(prisma, theirs.id, owner.id)), "refusé", feature.name);
    }
    // Rien n’a été modifié chez l’autre.
    const after = await prisma.project.findUniqueOrThrow({ where: { id: theirs.id } });
    assert.deepEqual(after, before);
    assert.equal(await prisma.integrationEndpoint.count({ where: { projectId: theirs.id } }), 0);
  });
});

test("changements d’offre : montée, descente, expiration et paiement échoué", async () => {
  await withTestDatabase(async (prisma) => {
    const followUps = FEATURES.find((feature) => feature.name === "Relances automatiques")!;
    const reports = FEATURES.find((feature) => feature.name === "Rapports programmés")!;
    const project = await seedProject(prisma, "starter");
    const owner = await createUser(prisma, "Propriétaire");
    await addMember(prisma, project.id, owner.id, "OWNER");

    assert.equal(await outcome(() => followUps.call(prisma, project.id, owner.id)), "refusé", "Starter");

    await prisma.project.update({ where: { id: project.id }, data: { plan: "business" } });
    assert.equal(await outcome(() => followUps.call(prisma, project.id, owner.id)), "autorisé", "montée");

    await prisma.project.update({ where: { id: project.id }, data: { plan: "starter" } });
    assert.equal(await outcome(() => followUps.call(prisma, project.id, owner.id)), "refusé", "descente");

    // Paiement échoué (past_due → paused) puis expiration : plus aucun envoi, plus de rapports.
    for (const status of ["paused", "inactive"] as const) {
      await prisma.project.update({ where: { id: project.id }, data: { plan: "business", status } });
      assert.equal(await outcome(() => reports.call(prisma, project.id, owner.id)), "refusé", `rapports ${status}`);
      assert.equal(
        await outcome(() => prisma.$transaction((tx) => reserveMessageQuota(tx, project.id))),
        "refusé",
        `envoi ${status}`,
      );
    }
  });
});
