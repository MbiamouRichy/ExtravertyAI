import { test } from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "../src/generated/prisma/client";
import { syncWhatsAppSettings } from "../lib/whatsapp-settings-sync";

test("immediate sync targets the requested project and preserves unrelated provider settings", async () => {
  const originalFetch = globalThis.fetch;
  const oldBase = process.env.EVOLUTION_API_URL;
  const oldKey = process.env.EVOLUTION_API_KEY;
  process.env.EVOLUTION_API_URL = "https://evolution.example";
  process.env.EVOLUTION_API_KEY = "test";
  const updates: unknown[] = [];
  const retry: unknown[] = [];
  const project = {
    id: "project-a",
    instanceName: "instance-a",
    whatsappSettingsPending: true,
    deletionPending: false,
    whatsappSyncAfter: new Date(0),
    whatsappAlwaysOnline: true,
    whatsappReadMessages: true,
  };
  const tx = {
    $queryRaw: async () => [],
    project: {
      findUnique: async () => project,
      update: async (input: unknown) => {
        updates.push(input);
      },
    },
  };
  const prisma = {
    project: {
      findFirst: async (input: { where: { id: string } }) => {
        assert.equal(input.where.id, project.id);
        return { id: project.id };
      },
      updateMany: async (input: unknown) => {
        retry.push(input);
      },
    },
    $transaction: async (callback: (client: typeof tx) => Promise<void>) =>
      callback(tx),
  } as unknown as PrismaClient;
  try {
    globalThis.fetch = async (url, init) => {
      assert.match(String(url), /instance-a$/);
      if (init?.method !== "POST")
        return Response.json({
          settings: {
            reject_call: true,
            msg_call: "Veuillez écrire.",
            groups_ignore: true,
            read_status: false,
            sync_full_history: false,
          },
        });
      assert.deepEqual(JSON.parse(String(init.body)), {
        rejectCall: true,
        msgCall: "Veuillez écrire.",
        groupsIgnore: true,
        readStatus: false,
        syncFullHistory: false,
        alwaysOnline: true,
        readMessages: true,
      });
      return Response.json({});
    };
    await syncWhatsAppSettings(prisma, project.id);
    assert.deepEqual(updates, [
      {
        where: { id: project.id },
        data: { whatsappSettingsPending: false, whatsappSettingsError: null },
      },
    ]);
    assert.equal(retry.length, 0);
    globalThis.fetch = async () => new Response("", { status: 503 });
    await syncWhatsAppSettings(prisma, project.id);
    assert.equal(updates.length, 1);
    assert.equal(retry.length, 1);
    assert.match(JSON.stringify(retry), /SETTINGS_HTTP_503/);
  } finally {
    globalThis.fetch = originalFetch;
    if (oldBase === undefined) delete process.env.EVOLUTION_API_URL;
    else process.env.EVOLUTION_API_URL = oldBase;
    if (oldKey === undefined) delete process.env.EVOLUTION_API_KEY;
    else process.env.EVOLUTION_API_KEY = oldKey;
  }
});
