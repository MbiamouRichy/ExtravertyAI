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
  "a one-member team gets every new conversation assigned to itself",
  { timeout: 600000 },
  async () => {
    await withTestDatabase(async (prisma) => {
      const solo = await createProject(prisma);
      const owner = await createUser(prisma, "Kuifeu Florence");
      await addMember(prisma, solo.id, owner.id, "OWNER");
      const contact = await ingestText(prisma, solo.id, "Bonjour");
      const saved = await prisma.contact.findUniqueOrThrow({
        where: { id: contact.id },
      });
      assert.equal(saved.assigneeId, owner.id);
      assert.ok(saved.assignedAt);

      // Une équipe de deux : aucune assignation implicite.
      const team = await createProject(prisma);
      const first = await createUser(prisma, "Clara Mba");
      const second = await createUser(prisma, "Inès Obame");
      await addMember(prisma, team.id, first.id, "OWNER");
      await addMember(prisma, team.id, second.id, "USER");
      const shared = await ingestText(prisma, team.id, "Bonsoir");
      assert.equal(
        (await prisma.contact.findUniqueOrThrow({ where: { id: shared.id } }))
          .assigneeId,
        null,
      );
    });
  },
);
