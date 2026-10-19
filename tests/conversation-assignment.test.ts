import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ConversationWorkflowError,
  assignConversation,
  assignableMembers,
} from "../lib/conversation-workflow";
import { unreadConversationCount } from "../lib/conversation-reads";
import { contactEventLabel } from "../lib/contact-details";
import { notificationFeed } from "../lib/notifications";
import {
  addMember,
  createProject,
  createUser,
  ingestText,
  withTestDatabase,
} from "./helpers/database";

test("assignment event labels", () => {
  assert.equal(
    contactEventLabel("ASSIGNED", "Clara Mba", "Inès"),
    "Clara a assigné la conversation à Inès",
  );
  assert.equal(
    contactEventLabel("ASSIGNED", "Clara Mba", null),
    "Clara a pris la conversation en charge",
  );
  assert.equal(contactEventLabel("UNASSIGNED", null), "Un membre a retiré l’assignation");
});

test("manual conversation assignment", { timeout: 120000 }, async (t) => {
  await withTestDatabase(async (prisma) => {
    const project = await createProject(prisma);
    const owner = await createUser(prisma, "Clara Mba");
    const member = await createUser(prisma, "Inès Obame");
    const outsider = await createUser(prisma, "Externe");
    await addMember(prisma, project.id, owner.id, "OWNER");
    await addMember(prisma, project.id, member.id, "USER");
    const contact = await ingestText(prisma, project.id, "Bonjour");
    const actor = { projectId: project.id, contactId: contact.id, userId: owner.id };

    await t.test("only project members can assign, and only to members", async () => {
      await assert.rejects(
        assignConversation(prisma, { ...actor, userId: outsider.id, assigneeId: owner.id }),
        ConversationWorkflowError,
      );
      await assert.rejects(
        assignConversation(prisma, { ...actor, assigneeId: outsider.id }),
        /ne fait plus partie/,
      );
      const other = await createProject(prisma);
      const otherContact = await ingestText(prisma, other.id, "Salut");
      await assert.rejects(
        assignConversation(prisma, { ...actor, contactId: otherContact.id, assigneeId: member.id }),
        /indisponible/,
      );
    });

    await t.test("assigning records who, when and a timeline event", async () => {
      const result = await assignConversation(prisma, { ...actor, assigneeId: member.id });
      assert.equal(result.changed, true);
      assert.equal(result.assignee?.id, member.id);
      const saved = await prisma.contact.findUniqueOrThrow({ where: { id: contact.id } });
      assert.equal(saved.assigneeId, member.id);
      assert.equal(saved.assignedById, owner.id);
      assert.ok(saved.assignedAt);
      const event = await prisma.contactEvent.findFirstOrThrow({
        where: { contactId: contact.id, type: "ASSIGNED" },
      });
      assert.equal(event.detail, "Inès");

      const again = await assignConversation(prisma, { ...actor, assigneeId: member.id });
      assert.equal(again.changed, false);
      assert.equal(
        await prisma.contactEvent.count({ where: { contactId: contact.id, type: "ASSIGNED" } }),
        1,
      );
    });

    await t.test("the assignee is notified, and filters count it", async () => {
      const feed = await notificationFeed(prisma, member.id);
      const item = feed.items.find((entry) => entry.key === "assigned:" + contact.id);
      assert.ok(item);
      assert.match(item.description, /^Clara vous a confié/);
      assert.equal(
        (await notificationFeed(prisma, owner.id)).items.some((entry) => entry.key.startsWith("assigned:")),
        false,
      );
      assert.equal(await unreadConversationCount(prisma, project.id, member.id, "", "mine"), 1);
      assert.equal(await unreadConversationCount(prisma, project.id, owner.id, "", "mine"), 0);
      assert.equal(await unreadConversationCount(prisma, project.id, owner.id, "", "unassigned"), 0);
    });

    await t.test("self-assignment does not notify and unassigning clears", async () => {
      await assignConversation(prisma, { ...actor, userId: member.id, assigneeId: member.id });
      // Reassigning to oneself while already assigned is a no-op.
      await assignConversation(prisma, { ...actor, userId: member.id, assigneeId: null });
      const cleared = await prisma.contact.findUniqueOrThrow({ where: { id: contact.id } });
      assert.equal(cleared.assigneeId, null);
      assert.equal(cleared.assignedById, null);
      assert.ok(
        await prisma.contactEvent.findFirst({ where: { contactId: contact.id, type: "UNASSIGNED" } }),
      );
      await assignConversation(prisma, { ...actor, userId: member.id, assigneeId: member.id });
      const self = await prisma.contactEvent.findFirstOrThrow({
        where: { contactId: contact.id, type: "ASSIGNED", actorId: member.id },
      });
      assert.equal(self.detail, null);
      const feed = await notificationFeed(prisma, member.id);
      assert.equal(feed.items.some((entry) => entry.key === "assigned:" + contact.id), false);
    });

    await t.test("member list is restricted to project members", async () => {
      const members = await assignableMembers(prisma, project.id, member.id);
      assert.deepEqual(
        members.map((entry) => entry.id).sort(),
        [owner.id, member.id].sort(),
      );
      assert.deepEqual(await assignableMembers(prisma, project.id, outsider.id), []);
    });
  });
});
