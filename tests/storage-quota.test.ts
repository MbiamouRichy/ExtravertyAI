import { test } from "node:test";
import assert from "node:assert/strict";
import { createProject, withTestDatabase } from "./helpers/database";
import {
  StorageQuotaError,
  formatStorage,
  releaseStorage,
  reserveStorage,
  storageUsage,
} from "../lib/storage-quota";
import { refreshOnlinePresence } from "../lib/whatsapp-presence";

const MB = 1024 * 1024;

test("file storage quota and online presence follow the plan", { timeout: 600000 }, async () => {
  await withTestDatabase(async (prisma) => {
    const starter = await createProject(prisma, { plan: "starter" });
    const reserve = (key: string, bytes: number, plan = "starter", projectId = starter.id) =>
      prisma.$transaction((tx) => reserveStorage(tx, { projectId, plan, key, bytes }));

    // Starter : 500 Mo.
    await reserve("a", 400 * MB);
    await assert.rejects(reserve("b", 200 * MB), StorageQuotaError);
    assert.equal((await storageUsage(prisma, starter.id, "starter")).used, 400 * MB);
    // Un fichier supprimé rend sa place.
    await releaseStorage(prisma, "a");
    await reserve("b", 200 * MB);

    // Pro : 1,2 Go, compté par projet.
    const pro = await createProject(prisma, { plan: "pro" });
    await reserve("c", 1000 * MB, "pro", pro.id);
    assert.equal((await storageUsage(prisma, pro.id, "pro")).limit, 1200 * MB);
    assert.equal(formatStorage(1200 * MB), "1,2 Go");
    assert.equal(formatStorage(500 * MB), "500 Mo");

    // Statut en ligne : seuls les numéros connectés qui l’ont demandé.
    await prisma.project.update({
      where: { id: pro.id },
      data: { whatsappAlwaysOnline: true, instanceStatus: "connected" },
    });
    await prisma.project.update({
      where: { id: starter.id },
      data: { whatsappAlwaysOnline: false, instanceStatus: "connected" },
    });
    process.env.EVOLUTION_API_URL ??= "https://evolution.example.com";
    process.env.EVOLUTION_API_KEY ??= "test-key";
    const calls: { url: string; body: string }[] = [];
    const refreshed = await refreshOnlinePresence(prisma, (async (url: string, init: RequestInit) => {
      calls.push({ url, body: String(init.body) });
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch);
    assert.equal(refreshed, 1);
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, new RegExp(`/instance/setPresence/${pro.instanceName}$`));
    assert.deepEqual(JSON.parse(calls[0].body), { presence: "available" });
  });
});
