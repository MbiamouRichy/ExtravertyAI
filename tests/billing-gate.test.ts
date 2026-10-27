import { test } from "node:test";
import assert from "node:assert/strict";
import { AGENT_DEFAULTS } from "../lib/agent-config";
import { SandboxError, runAgentTest } from "../lib/agent-sandbox";
import {
  KnowledgeError,
  addPdfSource,
  addUrlSource,
  deleteEntry,
  importProductsCsv,
  saveEntry,
} from "../lib/knowledge";
import { SettingsError, writeAgentConfig } from "../lib/project-settings";
import {
  activateBilling,
  addMember,
  createProject,
  createUser,
  withTestDatabase,
} from "./helpers/database";

const storage = { put: async () => {}, remove: async () => {} };
const PAYMENT = /paiement|abonnement|essai/;

test(
  "an unpaid project keeps its plan only after payment for AI features",
  { timeout: 600000 },
  async () => {
    await withTestDatabase(async (prisma) => {
      // Paiement abandonné : le projet porte l'offre Business mais reste inactif.
      const project = await createProject(prisma, { plan: "business" });
      await prisma.project.update({
        where: { id: project.id },
        data: { status: "inactive", agentSetupCompletedAt: new Date() },
      });
      const owner = await createUser(prisma, "Owner");
      await addMember(prisma, project.id, owner.id, "OWNER");
      const admin = { projectId: project.id, userId: owner.id };
      let generated = 0;
      const generate = async () => {
        generated++;
        return "Bonjour";
      };
      const sandbox = () =>
        runAgentTest(
          prisma,
          { ...admin, messages: [{ role: "user", content: "Bonjour" }] },
          generate,
        );
      const configure = (version: number) =>
        prisma.$transaction((tx) =>
          writeAgentConfig(tx, project.id, owner.id, version, {
            ...AGENT_DEFAULTS,
            agentSystemMessage:
              "Tu es l’assistant d’une boutique de chaussures à Libreville. Réponds aux clients.",
          }),
        );

      await assert.rejects(sandbox(), (error: unknown) => {
        assert.ok(error instanceof SandboxError);
        assert.match(error.message, PAYMENT);
        return true;
      });
      assert.equal(generated, 0);
      assert.equal(await prisma.agentTestRun.count({ where: { projectId: project.id } }), 0);

      await assert.rejects(configure(0), (error: unknown) => {
        assert.ok(error instanceof SettingsError);
        assert.match(error.message, PAYMENT);
        return true;
      });
      for (const run of [
        () => addUrlSource(prisma, { ...admin, url: "https://example.com/faq" }),
        () =>
          addPdfSource(
            prisma,
            { ...admin, fileName: "guide.pdf", bytes: Buffer.from("%PDF-1.4 guide") },
            storage,
          ),
        () =>
          importProductsCsv(prisma, {
            ...admin,
            fileName: "catalogue.csv",
            text: "nom,prix,stock,description\nSneakers,45000,3,Cuir",
          }),
      ]) {
        await assert.rejects(run(), (error: unknown) => {
          assert.ok(error instanceof KnowledgeError);
          assert.match(error.message, PAYMENT);
          return true;
        });
      }
      assert.equal(await prisma.knowledgeSource.count({ where: { projectId: project.id } }), 0);
      assert.equal(await prisma.storedFile.count({ where: { projectId: project.id } }), 0);

      // Les réponses écrites à la main et la suppression restent possibles.
      const entry = await saveEntry(prisma, {
        ...admin,
        entry: { kind: "FAQ", title: "Horaires ?", content: "9 h – 18 h", price: null, stock: null },
      });
      await deleteEntry(prisma, { ...admin, id: entry.id });

      // Une fois l'essai ou le paiement confirmé, tout se débloque.
      await activateBilling(prisma, project.id, "trialing");
      const version = (await prisma.project.findUniqueOrThrow({ where: { id: project.id } }))
        .agentConfigVersion;
      assert.equal(await configure(version), version + 1);
      await sandbox();
      assert.equal(generated, 1);
      await addUrlSource(prisma, { ...admin, url: "https://example.com/faq" });
    });
  },
);
