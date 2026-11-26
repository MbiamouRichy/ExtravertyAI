import { test } from "node:test";
import assert from "node:assert/strict";
import { withTestDatabase } from "./helpers/database";
import {
  createInstanceHealthMonitor,
  type DisconnectionEmail,
} from "../lib/instance-health";
import type { PrismaClient } from "../src/generated/prisma/client";

const env = {
  EVOLUTION_API_URL: "https://evolution.example.test/",
  EVOLUTION_API_KEY: "test-key",
  NEXT_PUBLIC_APP_URL: "https://app.example.test",
} as unknown as NodeJS.ProcessEnv;

/** Faux Evolution : l’état de chaque instance se règle pendant le test. */
function gateway(states: Map<string, string | Error>) {
  const calls: string[] = [];
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push(url);
    assert.equal((init?.headers as Record<string, string>).apikey, "test-key");
    const name = decodeURIComponent(url.split("/instance/connectionState/")[1] ?? "");
    const state = states.get(name);
    if (state instanceof Error) throw state;
    if (!state) return new Response("{}", { status: 404 });
    return Response.json({ instance: { instanceName: name, state } });
  }) as typeof fetch;
  return { fetchImpl, calls };
}

async function projectWithTeam(prisma: PrismaClient, instanceStatus: "connected" | "disconnected" = "connected") {
  const user = (name: string) =>
    prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        name,
        email: `${crypto.randomUUID()}@example.test`,
        emailVerified: true,
      },
    });
  const [owner, admin, agent] = [await user("Owner"), await user("Admin"), await user("Agent")];
  const project = await prisma.project.create({
    data: {
      name: "Boutique <Awa>",
      numero: "24100000000",
      instanceName: `inst-${crypto.randomUUID()}`,
      status: "active",
      instanceStatus,
      members: {
        create: [
          { userId: owner.id, role: "OWNER" },
          { userId: admin.id, role: "ADMIN" },
          { userId: agent.id, role: "AGENT" },
        ],
      },
    },
  });
  return { project, managers: [owner.email, admin.email].sort(), agent: agent.email };
}

test("instance health keeps the WhatsApp status true to the gateway", { timeout: 120000 }, async (t) => {
  await withTestDatabase(async (prisma) => {
    await t.test("a number closed twice is marked disconnected and its managers are e-mailed once", async () => {
      const { project, managers, agent } = await projectWithTeam(prisma);
      const states = new Map([[project.instanceName, "close"]]);
      const { fetchImpl } = gateway(states);
      const sent: DisconnectionEmail[] = [];
      const check = createInstanceHealthMonitor({
        db: prisma,
        fetchImpl,
        env,
        sendEmail: async (email) => void sent.push(email),
      });

      const first = await check();
      assert.deepEqual(first.demoted, []);
      assert.equal(
        (await prisma.project.findUniqueOrThrow({ where: { id: project.id } })).instanceStatus,
        "connected",
        "one closed answer may be a reconnection of a few seconds",
      );

      const second = await check();
      assert.deepEqual(second.demoted, [project.id]);
      assert.deepEqual(second.alerted, [project.id]);
      assert.equal(
        (await prisma.project.findUniqueOrThrow({ where: { id: project.id } })).instanceStatus,
        "disconnected",
      );
      assert.deepEqual(sent.map((email) => email.to).sort(), managers);
      assert.ok(!sent.some((email) => email.to === agent), "agents cannot reconnect WhatsApp");
      assert.ok(sent[0].html.includes("Boutique &lt;Awa&gt;"), "the project name is escaped");
      assert.ok(sent[0].html.includes(`https://app.example.test/projects/${project.id}/chat`));
      assert.ok(sent[0].text.includes(`/projects/${project.id}/chat`));
      assert.equal(new Set(sent.map((email) => email.idempotencyKey)).size, sent.length);

      await check();
      assert.equal(sent.length, managers.length, "no second alert for the same disconnection");
    });

    await t.test("a short reconnection never disconnects the project", async () => {
      const { project } = await projectWithTeam(prisma);
      const states = new Map([[project.instanceName, "close"]]);
      const check = createInstanceHealthMonitor({ db: prisma, fetchImpl: gateway(states).fetchImpl, env });
      await check();
      states.set(project.instanceName, "open");
      await check();
      states.set(project.instanceName, "close");
      const third = await check();
      assert.ok(!third.demoted.includes(project.id), "two closed answers must follow each other");
      assert.equal(
        (await prisma.project.findUniqueOrThrow({ where: { id: project.id } })).instanceStatus,
        "connected",
      );
    });

    await t.test("a disconnection learnt from the webhook is announced once Evolution confirms it", async () => {
      const { project, managers } = await projectWithTeam(prisma);
      const states = new Map([[project.instanceName, "open"]]);
      const sent: DisconnectionEmail[] = [];
      const check = createInstanceHealthMonitor({
        db: prisma,
        fetchImpl: gateway(states).fetchImpl,
        env,
        sendEmail: async (email) => void sent.push(email),
      });
      await check();
      await prisma.project.update({ where: { id: project.id }, data: { instanceStatus: "disconnected" } });
      states.set(project.instanceName, "close");
      const result = await check();
      assert.ok(result.alerted.includes(project.id));
      assert.deepEqual(
        sent.filter((email) => email.subject.includes(project.name)).map((email) => email.to).sort(),
        managers,
      );
    });

    await t.test("numbers already disconnected when the worker starts are not announced", async () => {
      const { project } = await projectWithTeam(prisma, "disconnected");
      const states = new Map([[project.instanceName, "close"]]);
      const sent: DisconnectionEmail[] = [];
      const check = createInstanceHealthMonitor({
        db: prisma,
        fetchImpl: gateway(states).fetchImpl,
        env,
        sendEmail: async (email) => void sent.push(email),
      });
      await check();
      await check();
      assert.equal(sent.filter((email) => email.subject.includes(project.name) && email.idempotencyKey.includes(project.id)).length, 0);
    });

    await t.test("a newer project change is never overwritten", async () => {
      const { project } = await projectWithTeam(prisma);
      const states = new Map([[project.instanceName, "close"]]);
      const check = createInstanceHealthMonitor({
        db: prisma,
        fetchImpl: gateway(states).fetchImpl,
        env,
        // The check « happens » before the project's last update, like a webhook racing it.
        now: () => new Date("2025-01-01T00:00:00Z"),
      });
      await check();
      const second = await check();
      assert.ok(!second.demoted.includes(project.id));
      assert.equal(
        (await prisma.project.findUniqueOrThrow({ where: { id: project.id } })).instanceStatus,
        "connected",
      );
    });

    await t.test("an unreachable gateway changes nothing", async () => {
      const { project } = await projectWithTeam(prisma);
      const states = new Map<string, string | Error>([[project.instanceName, new Error("ECONNREFUSED")]]);
      const sent: DisconnectionEmail[] = [];
      const check = createInstanceHealthMonitor({
        db: prisma,
        fetchImpl: gateway(states).fetchImpl,
        env,
        sendEmail: async (email) => void sent.push(email),
      });
      assert.deepEqual(await check(), { demoted: [], alerted: [] });
      assert.deepEqual(await check(), { demoted: [], alerted: [] });
      assert.equal(
        (await prisma.project.findUniqueOrThrow({ where: { id: project.id } })).instanceStatus,
        "connected",
      );
      assert.equal(sent.length, 0);
    });

    await t.test("without Evolution configured nothing is checked", async () => {
      const { fetchImpl, calls } = gateway(new Map());
      const check = createInstanceHealthMonitor({ db: prisma, fetchImpl, env: {} as unknown as NodeJS.ProcessEnv });
      assert.deepEqual(await check(), { demoted: [], alerted: [] });
      assert.equal(calls.length, 0);
    });
  });
});
