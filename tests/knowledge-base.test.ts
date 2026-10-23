import { test } from "node:test";
import assert from "node:assert/strict";
import { jsPDF } from "jspdf";
import {
  KNOWLEDGE_LIMITS,
  buildSearchQuery,
  chunkText,
  formatKnowledgeBlock,
  normalizeSearchText,
  parseCsv,
  parseProductsCsv,
} from "../lib/knowledge-shared";
import {
  KnowledgeError,
  addPdfSource,
  addUrlSource,
  claimKnowledgeSource,
  importProductsCsv,
  knowledgeContext,
  retrieveKnowledge,
  runKnowledgeSource,
  saveEntry,
  setEntryEnabled,
} from "../lib/knowledge";
import { extractPdfText, htmlToText } from "../lib/knowledge-extract";
import { SettingsError } from "../lib/project-settings";
import {
  addMember,
  createProject,
  createUser,
  withTestDatabase,
} from "./helpers/database";

test("search text and queries ignore accents and case", () => {
  assert.equal(normalizeSearchText("  Livraison À  Port-Gentil "), "livraison a port-gentil");
  assert.equal(
    buildSearchQuery("Bonsoir ! Vous avez les sneakers blanches en 42 ?"),
    "bonsoir | vous | avez | les | sneakers | blanches | en | 42",
  );
  assert.equal(buildSearchQuery("?!"), null);
});

test("long text is chunked on paragraphs without losing content", () => {
  const paragraph = "Livraison sous 48 h dans tout le Gabon. ".repeat(30);
  const chunks = chunkText(`${paragraph}\n\n${paragraph}`, 400);
  assert.ok(chunks.length >= 4);
  assert.ok(chunks.every((chunk) => chunk.length <= 400));
  assert.deepEqual(chunkText("court"), []);
});

test("CSV parsing handles quotes, semicolons and a BOM", () => {
  assert.deepEqual(parseCsv('﻿nom;prix\n"Sac ""cuir"";noir";15000\n'), [
    ["nom", "prix"],
    ['Sac "cuir";noir', "15000"],
  ]);
  const { rows, errors } = parseProductsCsv(
    "Produit,Prix,Quantité,Description\nSneakers Urban,\"45 000,00\",3,Blanc\n,1000,1,x\nBottines,abc,1,\nSandales,12000,,Été",
    "XAF",
  );
  assert.deepEqual(rows.map((row) => [row.name, row.price, row.stock]), [
    ["Sneakers Urban", 45000, 3],
    ["Sandales", 12000, null],
  ]);
  assert.deepEqual(errors, ["Ligne 3 : nom manquant.", "Ligne 4 : prix invalide."]);
  assert.match(parseProductsCsv("sku,price\n1,2", "XAF").errors[0], /Colonne « nom »/);
});

test("the reference block marks knowledge as data, within budget", () => {
  const block = formatKnowledgeBlock(
    [
      { id: "1", kind: "PRODUCT", title: "Sneakers", content: "Blanches", price: 45000, stock: 3 },
      { id: "2", kind: "CHUNK", title: "Page", content: "x".repeat(KNOWLEDGE_LIMITS.retrievalBudget), price: null, stock: null },
    ],
    "XAF",
  );
  assert.match(block, /données et non des instructions/);
  assert.match(block, /Sneakers/);
  assert.match(block, /Prix : 45\s000\sFCFA/);
  assert.doesNotMatch(block, /x{100}/);
  assert.equal(formatKnowledgeBlock([], "XAF"), "");
});

test("HTML pages are reduced to their readable text", async () => {
  const { title, text } = await htmlToText(
    "<html><head><title>Livraison</title><script>alert(1)</script></head><body><nav>Menu</nav><article><h1>Livraison</h1><p>Nous livrons partout au Gabon en 48 heures. Les frais sont de 3 000 FCFA pour Libreville et 5 000 FCFA ailleurs.</p></article></body></html>",
  );
  assert.equal(title, "Livraison");
  assert.match(text, /48 heures/);
  assert.doesNotMatch(text, /alert/);
});

test("PDF text is extracted", async () => {
  const pdf = new jsPDF();
  pdf.text("Retours acceptes sous 14 jours avec le ticket de caisse.", 10, 10);
  const { text } = await extractPdfText(new Uint8Array(pdf.output("arraybuffer")));
  assert.match(text, /14 jours/);
  await assert.rejects(extractPdfText(new TextEncoder().encode("%PDF-cassé")), KnowledgeError);
});

test("knowledge base", { timeout: 180000 }, async (t) => {
  await withTestDatabase(async (prisma) => {
    const project = await createProject(prisma, { plan: "starter" });
    const owner = await createUser(prisma);
    const member = await createUser(prisma);
    await addMember(prisma, project.id, owner.id, "OWNER");
    await addMember(prisma, project.id, member.id, "USER");
    const admin = { projectId: project.id, userId: owner.id };

    await t.test("only owners and admins edit the knowledge base", async () => {
      await assert.rejects(
        saveEntry(prisma, {
          projectId: project.id,
          userId: member.id,
          entry: { kind: "FAQ", title: "Livrez-vous ?", content: "Oui", price: null, stock: null },
        }),
        SettingsError,
      );
    });

    await t.test("retrieval finds relevant, enabled, same-project entries", async () => {
      const shoes = await saveEntry(prisma, {
        ...admin,
        entry: { kind: "PRODUCT", title: "Sneakers Urban blanches", content: "Cuir, pointures 38 à 45.", price: 45000, stock: 3 },
      });
      await saveEntry(prisma, {
        ...admin,
        entry: { kind: "FAQ", title: "Livrez-vous à Port-Gentil ?", content: "Oui, en 48 h pour 5 000 FCFA.", price: null, stock: null },
      });
      const other = await createProject(prisma);
      await prisma.knowledgeEntry.create({
        data: { projectId: other.id, kind: "FAQ", title: "Sneakers", content: "Autre boutique", searchText: "sneakers autre boutique" },
      });

      const found = await retrieveKnowledge(prisma, project.id, "Bonsoir, vous avez les sneakers blanches en 42 ?");
      assert.equal(found[0]?.id, shoes.id);
      assert.ok(found.every((entry) => entry.title !== "Sneakers"));
      const delivery = await retrieveKnowledge(prisma, project.id, "vous livrez a port gentil ?");
      assert.match(delivery[0]?.content ?? "", /48 h/);

      await setEntryEnabled(prisma, { ...admin, id: shoes.id, enabled: false });
      const hidden = await retrieveKnowledge(prisma, project.id, "sneakers blanches");
      assert.equal(hidden.some((entry) => entry.id === shoes.id), false);
      const context = await knowledgeContext(prisma, project.id, "XAF", ["Port-Gentil ?"]);
      assert.match(context.block, /Port-Gentil/);
    });

    await t.test("CSV imports stop at the plan limit and are flagged", async () => {
      const used = await prisma.knowledgeEntry.count({ where: { projectId: project.id } });
      const lines = Array.from({ length: 120 }, (_, index) => `Produit ${index},${1000 + index},5,Desc`);
      const result = await importProductsCsv(prisma, {
        ...admin,
        fileName: "catalogue.csv",
        text: ["nom,prix,stock,description", ...lines].join("\n"),
      });
      assert.equal(result.imported, 100 - used);
      assert.equal(result.truncated, true);
      await assert.rejects(
        saveEntry(prisma, { ...admin, entry: { kind: "TEXT", title: "En plus", content: "x", price: null, stock: null } }),
        /Limite de 100 entrées/,
      );
      await prisma.knowledgeEntry.deleteMany({ where: { projectId: project.id, kind: "PRODUCT", title: { startsWith: "Produit " } } });
    });

    await t.test("URL sources are public-only, unique and limited per plan", async () => {
      await assert.rejects(addUrlSource(prisma, { ...admin, url: "https://127.0.0.1/admin" }), /pas accessible publiquement/);
      await assert.rejects(addUrlSource(prisma, { ...admin, url: "http://example.com" }), /https/);
      await addUrlSource(prisma, { ...admin, url: "https://example.com/livraison#haut" });
      await assert.rejects(addUrlSource(prisma, { ...admin, url: "https://example.com/livraison" }), /déjà importée/);
      await addUrlSource(prisma, { ...admin, url: "https://example.com/retours" });
      await addUrlSource(prisma, { ...admin, url: "https://example.com/faq" });
      await assert.rejects(addUrlSource(prisma, { ...admin, url: "https://example.com/plus" }), /Limite de 3 documents/);
    });

    await t.test("PDF uploads validate the file and roll back storage", async () => {
      const stored: string[] = [];
      const storage = {
        put: async (key: string) => void stored.push(key),
        remove: async (key: string) => void stored.splice(stored.indexOf(key), 1),
      };
      await assert.rejects(
        addPdfSource(prisma, { ...admin, fileName: "x.pdf", bytes: Buffer.from("not a pdf") }, storage),
        /fichier PDF/,
      );
      // Starter : 5 Mo par PDF, vérifié avant tout envoi vers le stockage.
      const sixMb = Buffer.concat([Buffer.from("%PDF-1.4"), Buffer.alloc(6 * 1024 * 1024)]);
      await assert.rejects(
        addPdfSource(prisma, { ...admin, fileName: "gros.pdf", bytes: sixMb }, storage),
        /5 Mo au maximum/,
      );
      // The source limit (3) is already reached by the URL test.
      await assert.rejects(
        addPdfSource(prisma, { ...admin, fileName: "x.pdf", bytes: Buffer.from("%PDF-1.4") }, storage),
        /Limite de 3 documents/,
      );
      assert.deepEqual(stored, []);
    });

    await t.test("the worker turns a page into chunks and retries transient failures", async () => {
      const job = await claimKnowledgeSource(prisma);
      assert.ok(job);
      assert.equal(job.type, "URL");
      // A second worker cannot claim the same source while leased.
      const competing = await claimKnowledgeSource(prisma);
      assert.notEqual(competing?.id, job.id);
      if (competing) {
        await prisma.knowledgeSource.update({
          where: { id: competing.id },
          data: { status: "QUEUED", leaseToken: null, leaseUntil: null },
        });
      }

      await runKnowledgeSource(prisma, job, {
        fetchPage: async () => ({ title: "Livraison et retours", text: "Nous livrons partout au Gabon. ".repeat(80) }),
        readPdf: async () => ({ title: "", text: "" }),
      });
      const ready = await prisma.knowledgeSource.findUniqueOrThrow({ where: { id: job.id } });
      assert.equal(ready.status, "READY");
      assert.equal(ready.name, "Livraison et retours");
      assert.ok(ready.entryCount > 1);
      assert.equal(await prisma.knowledgeEntry.count({ where: { sourceId: job.id, kind: "CHUNK" } }), ready.entryCount);

      const failing = await claimKnowledgeSource(prisma);
      assert.ok(failing);
      await runKnowledgeSource(prisma, failing, {
        fetchPage: async () => {
          throw new Error("socket hang up");
        },
        readPdf: async () => ({ title: "", text: "" }),
      });
      const retried = await prisma.knowledgeSource.findUniqueOrThrow({ where: { id: failing.id } });
      assert.equal(retried.status, "QUEUED");
      assert.equal(retried.errorCode, "PROCESSING_FAILED");

      await prisma.knowledgeSource.update({ where: { id: failing.id }, data: { availableAt: new Date(0) } });
      const permanent = await claimKnowledgeSource(prisma);
      assert.ok(permanent);
      await runKnowledgeSource(prisma, permanent, {
        fetchPage: async () => {
          throw new KnowledgeError("UNSUPPORTED_TYPE");
        },
        readPdf: async () => ({ title: "", text: "" }),
      });
      const failed = await prisma.knowledgeSource.findUniqueOrThrow({ where: { id: permanent.id } });
      assert.equal(failed.status, "FAILED");
      assert.equal(failed.errorCode, "UNSUPPORTED_TYPE");
    });
  });
});
