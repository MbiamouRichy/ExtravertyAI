import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { z } from "zod";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { ingestMessage } from "../lib/evolution-ingestion";
import {
  ConversationWorkflowError,
  addContactTag,
  createInternalNote,
  projectTags,
  removeContactTag,
  setConversationResolved,
} from "../lib/conversation-workflow";
import { unreadConversationCount } from "../lib/conversation-reads";
import * as workflowSchema from "../lib/conversation-workflow-schema";
const { MAX_PROJECT_TAGS, TagNameSchema } = workflowSchema;

test("tag names accept letters, digits, spaces and hyphens only", () => {
  assert.equal(TagNameSchema.parse("  Client   VIP "), "Client VIP");
  assert.equal(TagNameSchema.parse("Relance-J7"), "Relance-J7");
  assert.equal(TagNameSchema.parse("Équipe 2"), "Équipe 2");
  for (const bad of ["a", "x".repeat(25), "<b>", "VIP!", "a--b", "-VIP"]) {
    assert.equal(TagNameSchema.safeParse(bad).success, false, bad);
  }
});

// Isolated PostgreSQL WASM database. Never reads DATABASE_URL.
test(
  "conversation resolution, tags and internal notes",
  { timeout: 120000 },
  async (t) => {
    const db = await PGlite.create();
    const server = new PGLiteSocketServer({ db, host: "127.0.0.1", port: 0 });
    let prisma: PrismaClient | undefined;
    try {
      for (const folder of (await readdir("prisma/migrations"))
        .filter((f) => /^\d/.test(f))
        .sort()) {
        await db.exec(
          await readFile(`prisma/migrations/${folder}/migration.sql`, "utf8"),
        );
      }
      await server.start();
      prisma = new PrismaClient({
        adapter: new PrismaPg({
          connectionString: `postgresql://postgres:postgres@${server.getServerConn()}/postgres`,
          max: 1,
        }),
      });
      const client = prisma;

      async function user() {
        return client.user.create({
          data: {
            id: crypto.randomUUID(),
            name: "Agent",
            email: crypto.randomUUID() + "@example.test",
          },
        });
      }
      async function fixture() {
        const project = await client.project.create({
          data: {
            name: "Test",
            numero: "24100000000",
            instanceName: crypto.randomUUID(),
            status: "active",
          },
        });
        const member = await user();
        await client.projectMembership.create({
          data: { projectId: project.id, userId: member.id, role: "AGENT" },
        });
        await incoming(project.id, crypto.randomUUID());
        const contact = await client.contact.findFirstOrThrow({
          where: { projectId: project.id },
        });
        const actor = {
          projectId: project.id,
          contactId: contact.id,
          userId: member.id,
        };
        return { project, member, contact, actor };
      }
      async function incoming(projectId: string, id: string) {
        await client.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT id FROM project WHERE id = ${projectId} FOR UPDATE`;
          await ingestMessage(tx, projectId, {
            key: { id, fromMe: false, remoteJid: "24112345678@s.whatsapp.net" },
            message: { conversation: "Bonjour" },
          });
        });
      }
      async function rejects(promise: Promise<unknown>, pattern: RegExp) {
        await assert.rejects(promise, (error: unknown) => {
          assert.ok(error instanceof ConversationWorkflowError);
          assert.match(error.message, pattern);
          return true;
        });
      }

      await t.test(
        "resolving is member-only and a new client message reopens",
        async () => {
          const { project, contact, actor, member } = await fixture();
          const outsider = await user();
          await rejects(
            setConversationResolved(client, {
              ...actor,
              userId: outsider.id,
              resolved: true,
            }),
            /indisponible/,
          );
          const other = await fixture();
          await rejects(
            setConversationResolved(client, {
              ...actor,
              contactId: other.contact.id,
              resolved: true,
            }),
            /indisponible/,
          );

          const latest = await client.message.findFirstOrThrow({
            where: { contactId: contact.id },
          });
          const { resolvedAt } = await setConversationResolved(client, {
            ...actor,
            resolved: true,
            seenMessageId: latest.id,
          });
          assert.ok(resolvedAt);
          let saved = await client.contact.findUniqueOrThrow({
            where: { id: contact.id },
          });
          assert.ok(saved.resolvedAt);
          assert.equal(saved.resolvedById, member.id);
          assert.equal(
            await unreadConversationCount(
              client,
              project.id,
              member.id,
              "",
              "resolved",
            ),
            1,
          );
          assert.equal(
            await unreadConversationCount(
              client,
              project.id,
              member.id,
              "",
              "ai",
            ),
            0,
          );

          await incoming(project.id, crypto.randomUUID());
          saved = await client.contact.findUniqueOrThrow({
            where: { id: contact.id },
          });
          assert.equal(saved.resolvedAt, null);
          assert.equal(saved.resolvedById, null);

          // The agent had not seen the newest client message.
          await rejects(
            setConversationResolved(client, {
              ...actor,
              resolved: true,
              seenMessageId: latest.id,
            }),
            /vient d’écrire/,
          );

          await client.project.update({
            where: { id: project.id },
            data: { deletionPending: true },
          });
          await rejects(
            setConversationResolved(client, { ...actor, resolved: true }),
            /indisponible/,
          );
        },
      );

      await t.test(
        "tags are unique per project, limited and isolated",
        async () => {
          const { project, actor } = await fixture();
          const vip = await addContactTag(client, { ...actor, name: "VIP" });
          const again = await addContactTag(client, { ...actor, name: "vip" });
          assert.equal(again.id, vip.id);
          assert.equal(
            await client.contactTag.count({
              where: { contactId: actor.contactId },
            }),
            1,
          );
          await rejects(
            addContactTag(client, { ...actor, name: "<script>" }),
            /Lettres/,
          );

          const other = await fixture();
          await rejects(
            addContactTag(client, {
              ...other.actor,
              contactId: actor.contactId,
              name: "Intrus",
            }),
            /indisponible/,
          );
          // A foreign tag id cannot unlink this project's tag.
          await removeContactTag(client, {
            ...other.actor,
            tagId: vip.id,
          });
          assert.equal(
            await client.contactTag.count({ where: { tagId: vip.id } }),
            1,
          );

          for (let i = 1; i < MAX_PROJECT_TAGS; i++) {
            await client.tag.create({
              data: {
                projectId: project.id,
                name: `Lot ${i}`,
                nameKey: `lot ${i}`,
              },
            });
          }
          await rejects(
            addContactTag(client, { ...actor, name: "Nouveau" }),
            /Limite de 20/,
          );
          assert.equal((await projectTags(client, project.id)).length, 20);

          await removeContactTag(client, { ...actor, tagId: vip.id });
          assert.equal(
            await client.tag.count({ where: { id: vip.id } }),
            0,
            "orphan tags are removed to free the project limit",
          );
          await addContactTag(client, { ...actor, name: "Nouveau" });
        },
      );

      await t.test(
        "internal notes stay outside WhatsApp messages and AI history",
        async () => {
          const { project, actor } = await fixture();
          const messagesBefore = await client.message.count({
            where: { projectId: project.id },
          });
          const jobsBefore = await client.outboundJob.count({
            where: { projectId: project.id },
          });
          const note = await createInternalNote(client, {
            ...actor,
            content: "  Rappeler jeudi  ",
          });
          assert.equal(note.content, "Rappeler jeudi");
          assert.equal(
            await client.message.count({ where: { projectId: project.id } }),
            messagesBefore,
          );
          assert.equal(
            await client.outboundJob.count({
              where: { projectId: project.id },
            }),
            jobsBefore,
          );
          await rejects(
            createInternalNote(client, { ...actor, content: "   " }),
            /Écrivez/,
          );
          await rejects(
            createInternalNote(client, {
              ...actor,
              content: "x".repeat(2001),
            }),
            /2 000/,
          );
          const outsider = await user();
          await rejects(
            createInternalNote(client, {
              ...actor,
              userId: outsider.id,
              content: "Fuite",
            }),
            /indisponible/,
          );
        },
      );
    } finally {
      await prisma?.$disconnect();
      await server.stop();
      await db.close();
    }
  },
);

function loadActions(options: { anonymous?: boolean } = {}) {
  const calls: Array<[string, unknown]> = [];
  const notified: string[] = [];
  class WorkflowError extends Error {}
  const record =
    (name: string, result: unknown = {}) =>
    async (_db: unknown, input: unknown) => {
      calls.push([name, input]);
      if ((input as { name?: string }).name === "Refus")
        throw new WorkflowError("Limite atteinte.");
      if ((input as { name?: string }).name === "Panne")
        throw new Error("database password=secret");
      return result;
    };
  const modules: Record<string, unknown> = {
    zod: { z },
    "@/lib/prisma": { default: {} },
    "@/lib/auth-server": {
      getSession: async () =>
        options.anonymous ? null : { user: { id: "actor" } },
    },
    "@/lib/chat-realtime": {
      notifyChatChanged: async (id: string) => notified.push(id),
    },
    "@/lib/conversation-workflow": {
      ConversationWorkflowError: WorkflowError,
      setConversationResolved: record("resolve", { resolvedAt: null }),
      addContactTag: record("tag", { id: "t", name: "VIP" }),
      removeContactTag: record("untag"),
      createInternalNote: record("note", {
        id: "n",
        content: "x",
        createdAt: new Date(0),
        author: null,
      }),
    },
    "@/lib/conversation-workflow-schema": workflowSchema,
  };
  const exports: Record<
    string,
    (input: unknown) => Promise<{ success: boolean; error?: string }>
  > = {};
  const source = ts.transpileModule(
    readFileSync("app/actions/conversation-workflow.ts", "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
      },
    },
  ).outputText;
  runInNewContext(source, {
    exports,
    console: { error: () => {} },
    require: (name: string) => {
      assert.ok(name in modules, name);
      return modules[name];
    },
  });
  return { actions: exports, calls, notified };
}

const ids = {
  projectId: "cmuhe8ap1000004l64j9yddk1",
  contactId: "cmuhe8ap1000004l64j9yddk2",
};

test("workflow actions validate input and require a session before any write", async () => {
  const anonymous = loadActions({ anonymous: true });
  assert.equal(
    (
      await anonymous.actions.addInternalNoteAction({
        ...ids,
        content: "Note",
      })
    ).success,
    false,
  );
  assert.equal(anonymous.calls.length, 0);

  const { actions, calls } = loadActions();
  for (const [action, input] of [
    ["setConversationResolvedAction", { ...ids, resolved: "yes" }],
    [
      "setConversationResolvedAction",
      { projectId: "x", contactId: ids.contactId, resolved: true },
    ],
    ["addContactTagAction", { ...ids, name: "<b>" }],
    ["removeContactTagAction", { ...ids, tagId: "../../" }],
    ["addInternalNoteAction", { ...ids, content: "" }],
  ] as const) {
    const result = await actions[action](input);
    assert.equal(result.success, false, action);
  }
  assert.equal(calls.length, 0);
});

test("workflow actions pass the session user, notify and keep errors safe", async () => {
  const { actions, calls, notified } = loadActions();
  const ok = await actions.addContactTagAction({ ...ids, name: " VIP " });
  assert.equal(ok.success, true);
  // Objects come from the vm realm: compare their JSON shape.
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0])), [
    "tag",
    { ...ids, name: "VIP", userId: "actor" },
  ]);
  assert.deepEqual(notified, [ids.projectId]);

  const refused = await actions.addContactTagAction({ ...ids, name: "Refus" });
  assert.deepEqual(JSON.parse(JSON.stringify(refused)), {
    success: false,
    error: "Limite atteinte.",
  });

  const crashed = await actions.addContactTagAction({ ...ids, name: "Panne" });
  assert.equal(crashed.success, false);
  assert.doesNotMatch(crashed.error ?? "", /password|secret/);

  const forged = await actions.addInternalNoteAction({
    ...ids,
    content: "Note",
    userId: "someone-else",
  });
  assert.equal(forged.success, true);
  assert.equal((calls.at(-1)?.[1] as { userId: string }).userId, "actor");
});
