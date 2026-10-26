import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addMember,
  createProject,
  createUser,
  ingestText,
  withTestDatabase,
} from "./helpers/database";

test(
  "a one-member Business team gets every new conversation assigned to itself",
  { timeout: 600000 },
  async () => {
    await withTestDatabase(async (prisma) => {
      const solo = await createProject(prisma, { plan: "business" });
      const owner = await createUser(prisma, "Kuifeu Florence");
      await addMember(prisma, solo.id, owner.id, "OWNER");
      const contact = await ingestText(prisma, solo.id, "Bonjour");
      const saved = await prisma.contact.findUniqueOrThrow({
        where: { id: contact.id },
      });
      assert.equal(saved.assigneeId, owner.id);
      assert.ok(saved.assignedAt);

      // Offres Starter et Pro : l'assignation automatique n'est pas incluse.
      const starter = await createProject(prisma, { plan: "pro" });
      const alone = await createUser(prisma, "Paul Ekang");
      await addMember(prisma, starter.id, alone.id, "OWNER");
      const unassigned = await ingestText(prisma, starter.id, "Salut");
      assert.equal(
        (
          await prisma.contact.findUniqueOrThrow({
            where: { id: unassigned.id },
          })
        ).assigneeId,
        null,
      );

      // Une équipe de deux : aucune assignation implicite.
      const team = await createProject(prisma, { plan: "business" });
      const first = await createUser(prisma, "Clara Mba");
      const second = await createUser(prisma, "Inès Obame");
      await addMember(prisma, team.id, first.id, "OWNER");
      await addMember(prisma, team.id, second.id, "AGENT");
      const shared = await ingestText(prisma, team.id, "Bonsoir");
      assert.equal(
        (await prisma.contact.findUniqueOrThrow({ where: { id: shared.id } }))
          .assigneeId,
        null,
      );
    });
  },
);

test(
  "a Business team spreads new conversations across online members",
  { timeout: 600000 },
  async () => {
    await withTestDatabase(async (prisma) => {
      const project = await createProject(prisma, { plan: "business" });
      const owner = await createUser(prisma, "Clara Mba");
      const ines = await createUser(prisma, "Inès Obame");
      const paul = await createUser(prisma, "Paul Ekang");
      const away = await createUser(prisma, "Absent");
      await addMember(prisma, project.id, owner.id, "OWNER");
      await addMember(prisma, project.id, ines.id, "AGENT");
      await addMember(prisma, project.id, paul.id, "ADMIN");
      await addMember(prisma, project.id, away.id, "AGENT");
      // En ligne : le propriétaire, Inès et Paul ; « Absent » n'a pas d'onglet ouvert.
      for (const user of [owner, ines, paul])
        await prisma.$executeRaw`INSERT INTO user_presence ("userId", "tabId", "lastSeenAt", "lastActiveAt")
          VALUES (${user.id}, 'tab', NOW(), NOW())`;

      const assigneeOf = async (phone: string, text: string) => {
        const contact = await ingestText(
          prisma,
          project.id,
          text,
          `${phone}@s.whatsapp.net`,
        );
        return (
          await prisma.contact.findUniqueOrThrow({ where: { id: contact.id } })
        ).assigneeId;
      };
      const first = await assigneeOf("24111111111", "Bonjour");
      const second = await assigneeOf("24122222222", "Bonsoir");
      // Jamais le propriétaire ni un membre hors ligne ; à tour de rôle.
      assert.deepEqual(new Set([first, second]), new Set([ines.id, paul.id]));

      // Le moins chargé passe devant : Paul résout sa conversation.
      await prisma.contact.updateMany({
        where: { projectId: project.id, assigneeId: paul.id },
        data: { resolvedAt: new Date() },
      });
      assert.equal(await assigneeOf("24133333333", "Salut"), paul.id);

      // Réglage coupé : plus de répartition.
      await prisma.project.update({
        where: { id: project.id },
        data: { autoAssignTeam: false },
      });
      assert.equal(await assigneeOf("24144444444", "Allô"), null);

      // Personne en ligne : la conversation reste non assignée.
      await prisma.project.update({
        where: { id: project.id },
        data: { autoAssignTeam: true },
      });
      await prisma.$executeRaw`DELETE FROM user_presence`;
      assert.equal(await assigneeOf("24155555555", "Hello"), null);
    });
  },
);
