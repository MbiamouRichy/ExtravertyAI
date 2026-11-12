import { test } from "node:test";
import assert from "node:assert/strict";
import {
  contactAvatarKey,
  contactAvatarUrl,
  isContactAvatarKey,
  isPersonJid,
  isWhatsAppPictureUrl,
  refreshContactAvatars,
  type AvatarDeps,
} from "../lib/contact-avatar";
import { withTestDatabase } from "./helpers/database";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const OTHER_PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 9, 9, 9]);
const PICTURE = "https://pps.whatsapp.net/v/t61.24694-24/photo.jpg?oe=ABC";

test("only WhatsApp-hosted pictures of individual accounts are accepted", () => {
  assert.ok(isWhatsAppPictureUrl(PICTURE));
  assert.ok(isWhatsAppPictureUrl("https://mmg.whatsapp.net/p.jpg"));
  for (const url of [
    "http://pps.whatsapp.net/p.jpg",
    "https://pps.whatsapp.net.evil.test/p.jpg",
    "https://evil.test/?u=pps.whatsapp.net",
    "https://pps.whatsapp.net:8443/p.jpg",
    "https://user:pass@pps.whatsapp.net/p.jpg",
    "https://169.254.169.254/latest",
    "file:///etc/passwd",
    "",
    null,
    42,
  ])
    assert.equal(isWhatsAppPictureUrl(url), false, String(url));

  assert.ok(isPersonJid("24106845039@s.whatsapp.net"));
  assert.ok(isPersonJid("123456789012345@lid"));
  assert.equal(isPersonJid("120363000000000000@g.us"), false);
  assert.equal(isPersonJid("status@broadcast"), false);
  assert.equal(isPersonJid("../../x@s.whatsapp.net"), false);
});

test("an avatar key belongs to one contact of one project", () => {
  const digest = "a".repeat(32);
  const key = contactAvatarKey("p1", "c1", digest, "image/png");
  assert.equal(key, `contact-avatars/p1/c1/${digest}.png`);
  assert.ok(isContactAvatarKey("p1", "c1", key));
  assert.equal(isContactAvatarKey("p2", "c1", key), false);
  assert.equal(isContactAvatarKey("p1", "c2", key), false);
  assert.equal(isContactAvatarKey("p1", "c1", "contact-avatars/p1/c1/../x.png"), false);
  assert.equal(contactAvatarUrl("p1", "c1", key), "/api/projects/p1/contacts/c1/avatar?v=aaaaaaaa");
  assert.equal(contactAvatarUrl("p2", "c1", key), null);
  assert.equal(contactAvatarUrl("p1", "c1", null), null);
});

type Answer = { status?: number; url?: string | null; bytes?: Uint8Array<ArrayBuffer>; length?: number };

/** Faux Evolution, faux WhatsApp et faux stockage, avec le journal des appels. */
function fakes(answer: () => Answer) {
  const calls: string[] = [];
  const stored = new Map<string, Uint8Array>();
  const removed: string[] = [];
  const deps: AvatarDeps = {
    evolution: () => ({ base: "http://evolution.test", key: "test-key" }),
    storage: async () => ({
      put: async (key, bytes) => void stored.set(key, bytes),
      remove: async (key) => void removed.push(key),
    }),
    fetch: (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const current = answer();
      if (url.includes("/chat/fetchProfilePictureUrl/")) {
        calls.push(`evolution:${JSON.parse(String(init?.body)).number}`);
        if (current.status) return new Response("{}", { status: current.status });
        return Response.json({ wuid: "x", profilePictureUrl: current.url ?? null });
      }
      calls.push(`download:${new URL(url).hostname}`);
      assert.equal(init?.redirect, "error");
      const bytes = current.bytes ?? PNG;
      return new Response(bytes, {
        headers: { "content-length": String(current.length ?? bytes.byteLength) },
      });
    }) as typeof fetch,
  };
  return { deps, calls, stored, removed };
}

test("the prospect's picture is copied once a week, deduplicated and removed when hidden", { timeout: 180000 }, async () => {
  await withTestDatabase(async (prisma) => {
    const project = (name: string, numero: string) =>
      prisma.project.create({
        data: { name, numero, instanceName: crypto.randomUUID(), instanceStatus: "connected" },
      });
    const shop = await project("Boutique", "24100000001");
    const neighbour = await project("Voisin", "24100000002");
    const jid = "24106845039@s.whatsapp.net";
    const contact = await prisma.contact.create({
      data: { projectId: shop.id, remoteJid: jid, phone: "24106845039" },
    });
    // Même numéro dans un autre projet : jamais touché par ce projet.
    const foreign = await prisma.contact.create({
      data: { projectId: neighbour.id, remoteJid: jid, phone: "24106845039" },
    });
    const run = (deps: AvatarDeps, remoteJids = [jid, "120363@g.us"]) =>
      refreshContactAvatars(prisma, { projectId: shop.id, instanceName: shop.instanceName, remoteJids }, deps);
    const read = () => prisma.contact.findUniqueOrThrow({ where: { id: contact.id } });
    const age = (days: number) =>
      prisma.$executeRaw`UPDATE contact SET "avatarCheckedAt" = (clock_timestamp() AT TIME ZONE 'UTC') - make_interval(days => ${days}) WHERE id = ${contact.id}`;

    // Premier message : la photo est téléchargée et recopiée.
    let answer: Answer = { url: PICTURE };
    const first = fakes(() => answer);
    const before = await read();
    assert.equal(await run(first.deps), 1);
    assert.deepEqual(first.calls, [`evolution:${jid}`, "download:pps.whatsapp.net"]);
    const saved = await read();
    assert.ok(isContactAvatarKey(shop.id, contact.id, saved.avatarKey));
    assert.deepEqual(first.stored.get(saved.avatarKey!), PNG);
    assert.ok(saved.avatarCheckedAt);
    // La conversation ne remonte pas dans la liste pour une simple photo.
    assert.deepEqual(saved.updatedAt, before.updatedAt);
    const other = await prisma.contact.findUniqueOrThrow({ where: { id: foreign.id } });
    assert.equal(other.avatarKey, null);
    assert.equal(other.avatarCheckedAt, null);

    // Nouveau message dans la semaine : aucun appel à WhatsApp.
    const again = fakes(() => answer);
    assert.equal(await run(again.deps), 0);
    assert.deepEqual(again.calls, []);

    // Une semaine plus tard, même image : rien n’est recopié.
    await age(8);
    const same = fakes(() => answer);
    assert.equal(await run(same.deps), 0);
    assert.equal(same.calls.length, 2);
    assert.equal(same.stored.size, 0);
    assert.equal((await read()).avatarKey, saved.avatarKey);

    // Nouvelle photo : remplacée, l’ancienne copie est supprimée.
    await age(8);
    answer = { url: PICTURE, bytes: OTHER_PNG };
    const changed = fakes(() => answer);
    assert.equal(await run(changed.deps), 1);
    const replaced = await read();
    assert.notEqual(replaced.avatarKey, saved.avatarKey);
    assert.deepEqual(changed.removed, [saved.avatarKey]);

    // Photo masquée par le prospect : plus d’avatar, la copie est supprimée.
    await age(8);
    answer = { url: null };
    const hidden = fakes(() => answer);
    assert.equal(await run(hidden.deps), 1);
    assert.equal((await read()).avatarKey, null);
    assert.deepEqual(hidden.removed, [replaced.avatarKey]);
    assert.deepEqual(hidden.calls, [`evolution:${jid}`]);

    // Panne d’Evolution : rien ne change et un nouvel essai reste possible dans l’heure.
    await age(8);
    answer = { status: 500 };
    const down = fakes(() => answer);
    assert.equal(await run(down.deps), 0);
    const retry = await read();
    const wait = retry.avatarCheckedAt!.getTime() + 7 * 86400000 - Date.now();
    assert.ok(wait > 30 * 60000 && wait <= 3600000, String(wait));

    // Fichiers refusés : autre hôte, page HTML, image trop lourde.
    for (const refused of [
      { url: "https://evil.test/photo.jpg" },
      { url: PICTURE, bytes: new TextEncoder().encode("<html>") },
      { url: PICTURE, length: 3 * 1024 * 1024 },
    ]) {
      await age(8);
      answer = refused;
      const blocked = fakes(() => answer);
      assert.equal(await run(blocked.deps), 0);
      assert.equal(blocked.stored.size, 0);
      assert.ok(!blocked.calls.includes("download:evil.test"));
      assert.equal((await read()).avatarKey, null);
    }

    // Numéro déconnecté ou projet en suppression : aucun appel.
    await age(8);
    answer = { url: PICTURE };
    for (const data of [{ instanceStatus: "disconnected" as const }, { deletionPending: true }]) {
      await prisma.project.update({ where: { id: shop.id }, data });
      const idle = fakes(() => answer);
      assert.equal(await run(idle.deps), 0);
      assert.deepEqual(idle.calls, []);
      await prisma.project.update({
        where: { id: shop.id },
        data: { instanceStatus: "connected", deletionPending: false },
      });
    }
    // Instance d’un autre projet : refusée.
    const wrong = fakes(() => answer);
    assert.equal(
      await refreshContactAvatars(
        prisma,
        { projectId: shop.id, instanceName: neighbour.instanceName, remoteJids: [jid] },
        wrong.deps,
      ),
      0,
    );
    assert.deepEqual(wrong.calls, []);
  });
});
