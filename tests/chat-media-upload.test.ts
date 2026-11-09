import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MAX_MEDIA_BYTES,
  isChatImageType,
  isGenericPastedName,
  pastedImageName,
  safeMediaFilename,
} from "../lib/chat-media";
import { verifyMediaTicket } from "../lib/chat-media-server";
import {
  acceptChatMediaUpload,
  decodeFilenameHeader,
  type ChatMediaUploadInput,
  type MediaStorage,
} from "../lib/chat-media-upload";
import { clipboardFiles, clipboardPrefersText } from "../lib/chat-paste";
import {
  addMember,
  createProject,
  createUser,
  withTestDatabase,
} from "./helpers/database";

const MB = 1024 * 1024;
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  Buffer.from("IHDR-fausse-image"),
]);
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70]);

function stream(bytes: Uint8Array) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

test("le nom de fichier du navigateur n’est jamais repris tel quel", () => {
  assert.equal(safeMediaFilename("../../etc/passwd", "image/png"), "passwd.png");
  assert.equal(safeMediaFilename("C:\\Users\\a\\photo.png", "image/png"), "photo.png");
  // L’extension suit le type vérifié, pas celle annoncée.
  assert.equal(safeMediaFilename("facture.exe", "image/png"), "facture.exe.png");
  assert.equal(safeMediaFilename("Photo.JPEG", "image/jpeg"), "Photo.JPEG");
  assert.equal(safeMediaFilename("photo.jpg", "image/webp"), "photo.jpg.webp");
  // Inversion bidirectionnelle, caractères invisibles et de contrôle retirés.
  const spoofed = safeMediaFilename("photo\u202egnp.exe", "image/png");
  assert.equal(spoofed, "photognp.exe.png");
  assert.equal(safeMediaFilename("a\u200bb\u0000c\r\n.png", "image/png"), "abc.png");
  // Ni fichier caché, ni caractères interdits sous Windows, ni nom vide.
  assert.equal(safeMediaFilename(".htaccess", "text/plain"), "htaccess.txt");
  assert.equal(safeMediaFilename('a<b>:"c"?.pdf', "application/pdf"), "a_b___c__.pdf");
  assert.equal(safeMediaFilename("", "image/png"), "fichier.png");
  assert.equal(safeMediaFilename("...", "image/png"), "fichier.png");
  assert.equal(safeMediaFilename("x", "constructor"), "x.bin");
  const long = safeMediaFilename("é".repeat(400) + ".png", "image/png");
  assert.ok(Array.from(long).length <= 180);
  assert.ok(long.endsWith(".png"));
});

test("images collées : types d’envoi, nom horodaté et presse-papiers", () => {
  assert.equal(isChatImageType("image/png"), true);
  assert.equal(isChatImageType("image/webp"), true);
  assert.equal(isChatImageType("image/gif"), false);
  assert.equal(isChatImageType("image/svg+xml"), false);

  const at = new Date(2026, 10, 8, 9, 5, 3);
  assert.equal(pastedImageName("image/png", at), "image-collée-20261108-090503.png");
  assert.equal(pastedImageName("image/jpeg", at, 1), "image-collée-20261108-090503-2.jpg");
  assert.equal(isGenericPastedName("image.png"), true);
  assert.equal(isGenericPastedName(""), true);
  assert.equal(isGenericPastedName("facture-mars.png"), false);

  const file = new File([png], "image.png", { type: "image/png" });
  const clipboard = (data: Record<string, string>, files: File[] = [file]) => ({
    items: files.map((entry) => ({ kind: "file", getAsFile: () => entry })),
    types: [...Object.keys(data), ...(files.length ? ["Files"] : [])],
    getData: (format: string) => data[format] ?? "",
  });
  // Capture d’écran : rien que l’image.
  assert.deepEqual(clipboardFiles(clipboard({})), [file]);
  assert.equal(clipboardPrefersText(clipboard({})), false);
  // Image copiée depuis une page web.
  assert.equal(
    clipboardPrefersText(
      clipboard({ "text/html": "<meta charset='utf-8'><img src=\"https://a.test/x.png\">" }),
    ),
    false,
  );
  // Fichier copié depuis le Finder : le texte n’est que son nom.
  assert.equal(clipboardPrefersText(clipboard({ "text/plain": "photo.png" })), false);
  // Cellules Excel ou texte Word : le texte l’emporte sur leur rendu en image.
  assert.equal(
    clipboardPrefersText(
      clipboard({
        "text/plain": "Total\t12",
        "text/html": "<style>td{color:red}</style><table><tr><td>Total</td><td>12</td></tr></table>",
      }),
    ),
    true,
  );
  assert.equal(
    clipboardPrefersText(clipboard({ "text/plain": "Bonjour", "text/rtf": "{\\rtf1 Bonjour}" })),
    true,
  );
  // Texte seul : aucun fichier, collage normal.
  assert.deepEqual(clipboardFiles(clipboard({ "text/plain": "Bonjour" }, [])), []);
});

test("en-tête du nom de fichier illisible ou démesuré : ignoré", () => {
  assert.equal(decodeFilenameHeader(encodeURIComponent("image-collée.png")), "image-collée.png");
  assert.equal(decodeFilenameHeader("%E0%A4%A"), "");
  assert.equal(decodeFilenameHeader("a".repeat(2000)), "");
  assert.equal(decodeFilenameHeader(null), "");
});

test(
  "l’import des pièces jointes revérifie rôle, projet, type réel, taille et quota",
  { timeout: 600000 },
  async () => {
    const previousSecret = process.env.BETTER_AUTH_SECRET;
    process.env.BETTER_AUTH_SECRET = "test-secret-only";
    try {
      await withTestDatabase(async (prisma) => {
        const project = await createProject(prisma, { plan: "starter" });
        await prisma.project.update({
          where: { id: project.id },
          data: { instanceStatus: "connected" },
        });
        const other = await createProject(prisma, { plan: "business" });
        const agent = await createUser(prisma, "Agent");
        const viewer = await createUser(prisma, "Lecteur");
        const stranger = await createUser(prisma, "Autre compte");
        await addMember(prisma, project.id, agent.id, "AGENT");
        await addMember(prisma, project.id, viewer.id, "VIEWER");
        await addMember(prisma, other.id, stranger.id, "OWNER");

        const stored = new Map<string, { bytes: Buffer; mime: string; filename: string }>();
        const removed: string[] = [];
        let beforePut: (() => Promise<void>) | null = null;
        const storage: MediaStorage = {
          async put({ key, bytes, mime, filename }) {
            await beforePut?.();
            stored.set(key, { bytes, mime, filename });
          },
          async remove(key) {
            removed.push(key);
            stored.delete(key);
          },
        };
        const upload = (overrides: Partial<ChatMediaUploadInput> & { bytes?: Uint8Array } = {}) => {
          const { bytes = png, ...input } = overrides;
          return acceptChatMediaUpload(prisma, storage, {
            userId: agent.id,
            projectId: project.id,
            requestId: crypto.randomUUID(),
            contentType: "image/png",
            contentLength: String(bytes.length),
            filename: encodeURIComponent("image-collée-20261108-090503.png"),
            body: stream(bytes),
            ...input,
          });
        };
        const quotaRows = () => prisma.storedFile.count({ where: { projectId: project.id } });

        // Image collée valide : ticket lié au projet, à l’agent et à la demande.
        const requestId = crypto.randomUUID();
        const accepted = await upload({ requestId });
        assert.equal(accepted.status, 200);
        assert.ok("token" in accepted.body);
        assert.equal(accepted.body.type, "IMAGE");
        const ticket = verifyMediaTicket(accepted.body.token, project.id, agent.id, requestId);
        assert.match(ticket.key, new RegExp(`^chat-media/${project.id}/[\\da-f-]{36}\\.png$`));
        assert.equal(stored.get(ticket.key)?.filename, "image-collée-20261108-090503.png");
        assert.equal(stored.get(ticket.key)?.mime, "image/png");
        assert.equal(await quotaRows(), 1);

        // Le nom fourni ne choisit ni la clé ni l’extension.
        const renamed = await upload({
          filename: encodeURIComponent("../../evil\u202egnp.exe"),
          contentType: "IMAGE/PNG; charset=binary",
        });
        assert.equal(renamed.status, 200);
        const renamedKey = [...stored.keys()].at(-1)!;
        assert.ok(!renamedKey.includes("evil"));
        assert.equal(stored.get(renamedKey)?.filename, "evilgnp.exe.png");

        // Type réel lu dans les octets : extension et type annoncé ne suffisent pas.
        const before = stored.size;
        for (const attempt of [
          { contentType: "image/png", bytes: jpeg },
          { contentType: "image/png", bytes: Buffer.from("<svg onload=alert(1)>") },
          { contentType: "image/jpeg", bytes: Buffer.from("<html><script>alert(1)</script>") },
          { contentType: "image/png", bytes: new Uint8Array() },
        ]) {
          const refused = await upload(attempt);
          assert.equal(refused.status, 400);
          assert.match(String("error" in refused.body && refused.body.error), /format/);
        }
        assert.equal((await upload({ contentType: "image/svg+xml" })).status, 415);
        assert.equal((await upload({ contentType: "image/gif" })).status, 415);
        assert.equal((await upload({ contentType: null })).status, 415);

        // Taille : annoncée, puis réellement lue (un en-tête menteur ne passe pas).
        assert.equal(
          (await upload({ contentLength: String(MAX_MEDIA_BYTES + 1) })).status,
          413,
        );
        const oversized = Buffer.concat([png, Buffer.alloc(MAX_MEDIA_BYTES)]);
        assert.equal((await upload({ bytes: oversized, contentLength: "10" })).status, 413);
        assert.equal(stored.size, before);

        // Appartenance et rôle : même réponse, sans rien stocker.
        for (const userId of [viewer.id, stranger.id, "inconnu"]) {
          const refused = await upload({ userId });
          assert.equal(refused.status, 404);
          assert.deepEqual(refused.body, { error: "Projet indisponible." });
        }
        assert.equal((await upload({ userId: stranger.id, projectId: other.id })).status, 409);
        assert.equal((await upload({ requestId: "pas-un-uuid" })).status, 400);
        assert.equal((await upload({ projectId: "../autre" })).status, 400);
        assert.equal(stored.size, before);

        // Projet déconnecté, puis en cours de suppression.
        await prisma.project.update({
          where: { id: project.id },
          data: { instanceStatus: "disconnected" },
        });
        assert.equal((await upload()).status, 409);
        await prisma.project.update({
          where: { id: project.id },
          data: { instanceStatus: "connected", deletionPending: true },
        });
        assert.equal((await upload()).status, 404);
        await prisma.project.update({
          where: { id: project.id },
          data: { deletionPending: false },
        });

        // Quota de l’offre (Starter : 500 Mo) : refus avant tout envoi au stockage.
        await prisma.storedFile.create({
          data: { key: "remplissage", projectId: project.id, bytes: 500 * MB - 10 },
        });
        const full = await upload();
        assert.equal(full.status, 413);
        assert.match(String("error" in full.body && full.body.error), /Espace de fichiers plein/);
        assert.equal(stored.size, before);
        await prisma.storedFile.delete({ where: { key: "remplissage" } });

        // Stockage indisponible : la place réservée est rendue.
        const rows = await quotaRows();
        beforePut = async () => {
          throw new Error("MinIO indisponible");
        };
        assert.equal((await upload()).status, 503);
        assert.equal(await quotaRows(), rows);

        // Rôle retiré pendant l’import : fichier supprimé et place rendue.
        beforePut = async () => {
          await prisma.projectMembership.update({
            where: { userId_projectId: { userId: agent.id, projectId: project.id } },
            data: { role: "VIEWER" },
          });
        };
        const revoked = await upload();
        assert.equal(revoked.status, 404);
        assert.equal(removed.length, 1);
        assert.ok(!stored.has(removed[0]));
        assert.equal(await quotaRows(), rows);
      });
    } finally {
      if (previousSecret === undefined) delete process.env.BETTER_AUTH_SECRET;
      else process.env.BETTER_AUTH_SECRET = previousSecret;
    }
  },
);
