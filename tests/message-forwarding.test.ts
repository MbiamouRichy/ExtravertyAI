import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { PrismaClient } from "../src/generated/prisma/client";
import {
  FORWARD_LIMITS,
  FORWARD_SOURCE,
  ForwardFormSchema,
  forwardMessage,
  forwardRequestId,
  forwardTargets,
} from "../lib/message-forwarding";
import { visibleMessageSources } from "../lib/message-sources";
import { addMember, createProject, createUser, ingestText, withTestDatabase } from "./helpers/database";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

test("each forwarded copy gets a stable request id of its own", () => {
  const request = randomUUID();
  const first = forwardRequestId(request, "contact-a");
  assert.match(first, /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(forwardRequestId(request, "contact-a"), first);
  assert.notEqual(forwardRequestId(request, "contact-b"), first);
  assert.notEqual(forwardRequestId(randomUUID(), "contact-a"), first);
  assert.equal(ForwardFormSchema.safeParse({ contactIds: [] }).success, false);
  assert.equal(
    ForwardFormSchema.safeParse({ contactIds: Array.from({ length: FORWARD_LIMITS.maxTargets + 1 }, () => "c" + "x".repeat(24)) })
      .success,
    false,
  );
  assert.equal(visibleMessageSources([{ source: FORWARD_SOURCE, count: 2 }])[0].label, "Message transféré");
});

async function connectedProject(prisma: PrismaClient) {
  const project = await createProject(prisma, { plan: "pro" });
  await prisma.project.update({
    where: { id: project.id },
    data: { instanceStatus: "connected", agentSetupCompletedAt: new Date() },
  });
  await prisma.quotaPeriod.create({
    data: {
      projectId: project.id,
      key: "test-" + project.id,
      kind: "active",
      startsAt: new Date(Date.now() - DAY),
      endsAt: new Date(Date.now() + DAY),
      limit: 1000,
    },
  });
  return project;
}

let phone = 24166400000;
const jid = () => `${++phone}@s.whatsapp.net`;

test("a message is forwarded to other conversations of the same project", { timeout: 600000 }, async () => {
  await withTestDatabase(async (prisma) => {
    const agent = await createUser(prisma, "Paul Nzé");
    const viewer = await createUser(prisma, "Lecteur");
    const project = await connectedProject(prisma);
    const other = await connectedProject(prisma);
    await addMember(prisma, project.id, agent.id, "AGENT");
    await addMember(prisma, project.id, viewer.id, "VIEWER");
    await addMember(prisma, other.id, agent.id, "AGENT");

    const source = await ingestText(prisma, project.id, "Le pack complet est à 150 000 FCFA.", jid());
    const awa = await ingestText(prisma, project.id, "Bonjour, des nouvelles ?", jid());
    await prisma.contact.update({ where: { id: awa.id }, data: { name: "Awa Nguema" } });
    const jean = await ingestText(prisma, project.id, "Combien pour la livraison ?", jid());
    await prisma.contact.update({ where: { id: jean.id }, data: { name: "Jean Obiang" } });
    const silent = await ingestText(prisma, project.id, "Merci", jid());
    await prisma.contact.update({ where: { id: silent.id }, data: { name: "Client silencieux" } });
    await prisma.message.updateMany({
      where: { contactId: silent.id },
      data: { createdAt: new Date(Date.now() - 30 * HOUR) },
    });
    const foreign = await ingestText(prisma, other.id, "Bonjour", jid());
    const message = await prisma.message.findFirstOrThrow({ where: { contactId: source.id } });
    const sentByAgent = await prisma.message.create({
      data: {
        projectId: project.id,
        contactId: source.id,
        agentId: agent.id,
        content: "Ce message n’est jamais parti.",
        senderType: "AGENT",
        fromMe: true,
        status: "FAILED",
      },
    });

    // Destinations proposées : les autres conversations, fenêtre de 24 h à l'appui.
    const targets = await forwardTargets(prisma, {
      projectId: project.id,
      userId: agent.id,
      excludeContactId: source.id,
    });
    assert.equal(targets.some((target) => target.id === source.id), false);
    assert.equal(targets.some((target) => target.id === foreign.id), false);
    assert.ok(targets.find((target) => target.id === awa.id)?.windowClosesAt);
    assert.equal(targets.find((target) => target.id === silent.id)?.windowClosesAt, null);
    assert.deepEqual(
      (await forwardTargets(prisma, { projectId: project.id, userId: agent.id, excludeContactId: source.id, query: "awa" })).map(
        (target) => target.name,
      ),
      ["Awa Nguema"],
    );
    await assert.rejects(
      forwardTargets(prisma, { projectId: project.id, userId: viewer.id, excludeContactId: source.id }),
      { message: "Accès refusé." },
    );

    const forward = (userId: string, contactIds: string[], requestId = randomUUID(), messageId = message.id) =>
      forwardMessage(prisma, { projectId: project.id, userId, messageId, contactIds, requestId });

    // Refus : rôle, conversation d'origine, autre projet, fenêtre fermée, trop de destinataires.
    await assert.rejects(forward(viewer.id, [awa.id]), { message: "Accès refusé." });
    await assert.rejects(forward(agent.id, [source.id]), /d’autres conversations/);
    await assert.rejects(forward(agent.id, [awa.id, foreign.id]), /n’est plus disponible/);
    await assert.rejects(forward(agent.id, [awa.id, silent.id]), /fenêtre de 24 h de WhatsApp est fermée pour Client silencieux/);
    await assert.rejects(
      forward(agent.id, Array.from({ length: FORWARD_LIMITS.maxTargets + 1 }, (_, index) => `c${String(index).padStart(24, "0")}`)),
      /10 conversations au plus/,
    );
    await assert.rejects(forward(agent.id, [awa.id], randomUUID(), sentByAgent.id), /n’est pas parti/);
    await assert.rejects(
      forwardMessage(prisma, {
        projectId: other.id,
        userId: agent.id,
        messageId: message.id,
        contactIds: [foreign.id],
        requestId: randomUUID(),
      }),
      /Message introuvable/,
    );
    // Tout ou rien : aucun envoi n'est parti pendant ces refus.
    assert.equal(await prisma.message.count({ where: { projectId: project.id, source: FORWARD_SOURCE } }), 0);

    // Transfert vers deux conversations, au nom du membre, par la file d'envoi normale.
    const requestId = randomUUID();
    assert.deepEqual(await forward(agent.id, [awa.id, jean.id, awa.id], requestId), { forwarded: 2, created: 2 });
    const copies = await prisma.message.findMany({
      where: { projectId: project.id, source: FORWARD_SOURCE },
      include: { outboundJob: true },
      orderBy: { contactId: "asc" },
    });
    assert.deepEqual(copies.map((copy) => copy.contactId).sort(), [awa.id, jean.id].sort());
    for (const copy of copies) {
      assert.equal(copy.content, "Le pack complet est à 150 000 FCFA.");
      assert.equal(copy.agentId, agent.id);
      assert.equal(copy.senderType, "AGENT");
      assert.equal(copy.outboundJob?.state, "QUEUED");
      assert.equal(copy.outboundJob?.requestId, forwardRequestId(requestId, copy.contactId));
    }
    assert.equal((await prisma.contact.findUniqueOrThrow({ where: { id: awa.id } })).aiActive, false);
    assert.equal((await prisma.contact.findUniqueOrThrow({ where: { id: source.id } })).aiActive, true);

    // Un nouvel essai de la même demande ne double rien.
    assert.deepEqual(await forward(agent.id, [awa.id, jean.id], requestId), { forwarded: 2, created: 0 });
    assert.equal(await prisma.message.count({ where: { projectId: project.id, source: FORWARD_SOURCE } }), 2);
    const quota = await prisma.quotaPeriod.findFirstOrThrow({ where: { projectId: project.id } });
    assert.equal(quota.used, 2);
  });
});
