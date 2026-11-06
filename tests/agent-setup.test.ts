import { test } from "node:test";
import assert from "node:assert/strict";
import { AGENT_DEFAULTS } from "../lib/agent-config";
import { SandboxError, runAgentTest } from "../lib/agent-sandbox";
import type { ProjectStatus } from "../src/generated/prisma/client";
import { SettingsError, activateAgent, writeAgentConfig } from "../lib/project-settings";
import { addMember, createUser, withTestDatabase } from "./helpers/database";

const CONFIG = {
  ...AGENT_DEFAULTS,
  agentName: "Nova",
  agentSystemMessage: "Tu es l’assistant d’une boutique de chaussures à Libreville.",
};

// Configuration initiale : brouillon, test dans le bac à sable, puis activation explicite.
test("the agent is tested on its draft and answers on WhatsApp only once activated", { timeout: 180000 }, async () => {
  await withTestDatabase(async (prisma) => {
    const project = async (status: ProjectStatus = "trialing") => {
      const created = await prisma.project.create({
        data: {
          name: "Boutique",
          numero: "24100000000",
          instanceName: crypto.randomUUID(),
          status,
          plan: "starter",
          instanceStatus: "connected",
        },
      });
      await prisma.quotaPeriod.create({
        data: {
          projectId: created.id,
          key: `trial:${created.id}`,
          kind: "trialing",
          startsAt: new Date(Date.now() - 60000),
          endsAt: new Date(Date.now() + 86400000),
          limit: 150,
        },
      });
      return created;
    };
    const shop = await project();
    const owner = await createUser(prisma, "Clara Mba");
    const agent = await createUser(prisma, "Inès Obame");
    await addMember(prisma, shop.id, owner.id, "OWNER");
    await addMember(prisma, shop.id, agent.id, "AGENT");
    type Generate = NonNullable<Parameters<typeof runAgentTest>[2]>;
    const sandbox = (generate: Generate = async () => "Bonjour, que puis-je pour vous ?") =>
      runAgentTest(
        prisma,
        { projectId: shop.id, userId: owner.id, messages: [{ role: "user", content: "Bonjour" }] },
        generate,
      );

    // Rien à tester tant qu’aucune mission n’est enregistrée.
    await assert.rejects(sandbox(), (error: unknown) => error instanceof SandboxError && /Terminez/.test(error.message));

    // Brouillon : enregistré, mais l’agent reste inactif sur WhatsApp.
    const version = await prisma.$transaction((tx) =>
      writeAgentConfig(tx, shop.id, owner.id, 0, CONFIG, { activate: false }),
    );
    assert.equal(version, 1);
    const draft = await prisma.project.findUniqueOrThrow({ where: { id: shop.id } });
    assert.equal(draft.agentSetupCompletedAt, null);
    assert.equal(draft.agentName, "Nova");

    // Le brouillon se teste avec la génération de production, sans rien envoyer.
    let prompted = "";
    const result = await sandbox(async (_messages, _project, _contact, config) => {
      prompted = config.agentName;
      return "Bonjour, je suis Nova. Que cherchez-vous ?";
    });
    assert.equal(prompted, "Nova");
    assert.equal(result.reply, "Bonjour, je suis Nova. Que cherchez-vous ?");
    assert.equal(await prisma.agentTestRun.count({ where: { projectId: shop.id } }), 1);
    assert.equal(await prisma.message.count({ where: { projectId: shop.id } }), 0);
    assert.equal((await prisma.quotaPeriod.findFirstOrThrow({ where: { projectId: shop.id } })).used, 0);

    // Seuls le propriétaire et les administrateurs activent l’agent.
    await assert.rejects(
      prisma.$transaction((tx) => activateAgent(tx, shop.id, agent.id)),
      (error: unknown) => error instanceof SettingsError && /droits/.test(error.message),
    );
    await assert.rejects(
      prisma.$transaction((tx) => activateAgent(tx, shop.id, "outsider")),
      SettingsError,
    );
    assert.equal(await prisma.$transaction((tx) => activateAgent(tx, shop.id, owner.id)), true);
    const active = await prisma.project.findUniqueOrThrow({ where: { id: shop.id } });
    assert.ok(active.agentSetupCompletedAt);
    assert.equal(
      await prisma.settingsAudit.count({ where: { projectId: shop.id, action: "agent.activated" } }),
      1,
    );
    // Deuxième clic ou deuxième onglet : rien ne change.
    assert.equal(await prisma.$transaction((tx) => activateAgent(tx, shop.id, owner.id)), false);
    // Un brouillon enregistré ensuite ne désactive pas l’agent.
    await prisma.$transaction((tx) =>
      writeAgentConfig(tx, shop.id, owner.id, 1, { ...CONFIG, agentName: "Lina" }, { activate: false }),
    );
    assert.deepEqual(
      (await prisma.project.findUniqueOrThrow({ where: { id: shop.id } })).agentSetupCompletedAt,
      active.agentSetupCompletedAt,
    );

    // La configuration enregistrée est revalidée : une mission vide ne s’active pas.
    const empty = await project();
    await addMember(prisma, empty.id, owner.id, "OWNER");
    await assert.rejects(
      prisma.$transaction((tx) => activateAgent(tx, empty.id, owner.id)),
      (error: unknown) => error instanceof SettingsError && /Terminez/.test(error.message),
    );

    // Sans essai ni abonnement en cours, l’agent ne s’active pas.
    const unpaid = await project("inactive");
    await addMember(prisma, unpaid.id, owner.id, "OWNER");
    await prisma.project.update({ where: { id: unpaid.id }, data: { agentSystemMessage: CONFIG.agentSystemMessage } });
    await assert.rejects(prisma.$transaction((tx) => activateAgent(tx, unpaid.id, owner.id)), SettingsError);
    assert.equal(
      (await prisma.project.findUniqueOrThrow({ where: { id: unpaid.id } })).agentSetupCompletedAt,
      null,
    );
  });
});
