import { test } from "node:test";
import assert from "node:assert/strict";
import { jsPDF } from "jspdf";
import {
  KNOWLEDGE_LIMITS,
  buildSearchQuery,
  chunkText,
  countEntryWords,
  extractBlocks,
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
  knowledgeOverview,
  sourceContent,
  retrieveKnowledge,
  runKnowledgeSource,
  saveEntry,
  setEntryEnabled,
} from "../lib/knowledge";
import { extractPdfText, htmlToText } from "../lib/knowledge-extract";
import { SettingsError } from "../lib/project-settings";
import {
  addMember,
  activateBilling,
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

test("neighbouring HTML blocks stay separate words", async () => {
  const { text } = await htmlToText(
    '<html><body><article><div><h2>Contact</h2><div>Réponse humaine sur WhatsApp, du lundi au samedi, pour toutes vos demandes.</div></div><div><a href="/x">Téléphone</a><a href="/y">E-mail</a></div></article></body></html>',
  );
  assert.doesNotMatch(text, /ContactRéponse|TéléphoneE-mail/);
});

test("modern page markup keeps its lines, and reads as titles and paragraphs", async () => {
  const { text } = await htmlToText(
    `<html><body><article><h2>Ce que votre agent ne fera jamais.</h2><p>Ces règles font partie des consignes de chaque agent et ne peuvent pas être retirées par la suite.</p><ol><li><div><p><span>02.<!-- -->1</span></p><div><p>Jamais</p><h3>Inventer un prix</h3><p>Il s’appuie sur vos informations vérifiées et dit clairement ce qu’il ne sait pas.</p></div></div></li></ol><p><span>Contact</span><span>Réponse humaine sur WhatsApp du lundi au samedi, pour toutes vos demandes et celles de vos clients.</span></p></article></body></html>`,
  );
  assert.match(text, /Jamais\n+Inventer un prix\n+Il s’appuie/);
  assert.match(text, /Contact Réponse humaine/);
  assert.deepEqual(extractBlocks(["01\nInventer un prix\nInventer un prix\nIl dit ce qu’il ne sait pas."]), [
    { type: "heading", text: "Inventer un prix" },
    { type: "paragraph", text: "Il dit ce qu’il ne sait pas." },
  ]);
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
    await activateBilling(prisma, project.id);
    const owner = await createUser(prisma);
    const member = await createUser(prisma);
    await addMember(prisma, project.id, owner.id, "OWNER");
    await addMember(prisma, project.id, member.id, "AGENT");
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

    await t.test("the assistant sees every enabled entry, even without a matching word", async () => {
      const greeting = await knowledgeContext(prisma, project.id, "XAF", ["Bonjour"]);
      assert.match(greeting.block, /Port-Gentil/);
      assert.equal(greeting.entries.length, 0);
      // Une entrée désactivée reste écartée, celles d’un autre projet aussi.
      assert.doesNotMatch(greeting.block, /Sneakers Urban/);
      assert.doesNotMatch(greeting.block, /Autre boutique/);
    });

    await t.test("imported text is readable in order, by project admins only", async () => {
      const source = await prisma.knowledgeSource.create({
        data: { projectId: project.id, type: "URL", name: "Page", url: "https://example.com/lu", status: "READY" },
      });
      for (const index of [10, 2, 1]) {
        await prisma.knowledgeEntry.create({
          data: { projectId: project.id, sourceId: source.id, kind: "CHUNK", title: `Page · ${index}/10`, content: `Passage ${index}`, searchText: `passage ${index}` },
        });
      }
      const passages = await sourceContent(prisma, { ...admin, sourceId: source.id });
      assert.deepEqual(passages.map((passage) => passage.content), ["Passage 1", "Passage 2", "Passage 10"]);
      const outsider = await createUser(prisma);
      await assert.rejects(
        sourceContent(prisma, { projectId: project.id, userId: outsider.id, sourceId: source.id }),
        /Accès refusé/,
      );
      await prisma.knowledgeSource.delete({ where: { id: source.id } });
    });

    await t.test("CSV imports stop at the entry guard and are flagged", async () => {
      const used = await prisma.knowledgeEntry.count({ where: { projectId: project.id } });
      const lines = Array.from({ length: 520 }, (_, index) => `Produit ${index},${1000 + index},5,Desc`);
      const result = await importProductsCsv(prisma, {
        ...admin,
        fileName: "catalogue.csv",
        text: ["nom,prix,stock,description", ...lines].join("\n"),
      });
      assert.equal(result.imported, 500 - used);
      assert.equal(result.truncated, true);
      await assert.rejects(
        saveEntry(prisma, { ...admin, entry: { kind: "TEXT", title: "En plus", content: "x", price: null, stock: null } }),
        /Limite de 500 entrées/,
      );
      await prisma.knowledgeEntry.deleteMany({ where: { projectId: project.id, kind: "PRODUCT", title: { startsWith: "Produit " } } });
      await prisma.knowledgeSource.deleteMany({ where: { projectId: project.id, type: "CSV" } });
    });

    await t.test("the plan's word volume caps every addition", async () => {
      const words = (count: number) => Array.from({ length: count }, () => "mot").join(" ");
      const wordsIn = async () =>
        (await prisma.knowledgeEntry.aggregate({ where: { projectId: project.id }, _sum: { words: true } }))._sum.words ?? 0;

      // Starter : 20 000 mots. Un catalogue qui ne tient pas est refusé entier.
      const heavy = Array.from({ length: 60 }, (_, index) => `Produit ${index},1000,5,${words(400)}`);
      await assert.rejects(
        importProductsCsv(prisma, { ...admin, fileName: "gros.csv", text: ["nom,prix,stock,description", ...heavy].join("\n") }),
        /environ 24\s120 mots, il en reste/,
      );
      assert.equal(await prisma.knowledgeSource.count({ where: { projectId: project.id, type: "CSV" } }), 0);

      // La base compte elle-même les mots (titre + contenu), comme l’application.
      await prisma.knowledgeEntry.createMany({
        data: Array.from({ length: 20 }, (_, index) => ({
          projectId: project.id,
          kind: "TEXT" as const,
          title: `Remplissage ${index}`,
          content: `\n ${words(990)}  `,
          searchText: "remplissage",
        })),
      });
      const filler = await prisma.knowledgeEntry.findFirstOrThrow({
        where: { projectId: project.id, title: "Remplissage 0" },
      });
      assert.equal(filler.words, 992);
      assert.equal(countEntryWords(filler), 992);
      const overview = await knowledgeOverview(prisma, project.id, owner.id);
      assert.equal(overview?.usage.words, await wordsIn());
      assert.equal(overview?.usage.wordLimit, 20_000);

      // Il ne reste que 3 mots.
      const left = 20_000 - (await wordsIn());
      assert.ok(left > 5 && left < 1000);
      await prisma.knowledgeEntry.create({
        data: { projectId: project.id, kind: "TEXT", title: "Remplissage", content: words(left - 4), searchText: "reste" },
      });
      const entry = (title: string, count: number) => ({
        kind: "TEXT" as const,
        title,
        content: words(count),
        price: null,
        stock: null,
      });
      await assert.rejects(
        saveEntry(prisma, { ...admin, entry: entry("Horaires", 10) }),
        /environ 11 mots, il en reste 3 dans votre base \(20\s000 mots/,
      );
      // Allonger au-delà du reste est refusé ; raccourcir est toujours permis.
      await assert.rejects(
        saveEntry(prisma, { ...admin, id: filler.id, entry: entry("Remplissage 0", 1000) }),
        /il en reste 3 dans/,
      );
      await saveEntry(prisma, { ...admin, id: filler.id, entry: entry("Remplissage 0", 100) });
      assert.equal(20_000 - (await wordsIn()), 3 + 890);

      // Base pleine : aucun document de plus.
      await prisma.knowledgeEntry.create({
        data: { projectId: project.id, kind: "TEXT", title: "Plein", content: words(1000), searchText: "plein" },
      });
      await assert.rejects(addUrlSource(prisma, { ...admin, url: "https://example.com/plein" }), /base de connaissances est pleine/);
      await prisma.knowledgeEntry.deleteMany({ where: { projectId: project.id, title: "Plein" } });
      // Un document plus long que le reste (893 mots) est refusé entier.
      const source = await prisma.knowledgeSource.create({
        data: { projectId: project.id, type: "URL", name: "Trop long", url: "https://example.com/long", status: "QUEUED" },
      });
      const job = await claimKnowledgeSource(prisma);
      assert.equal(job?.id, source.id);
      await runKnowledgeSource(prisma, job!, {
        fetchPage: async () => ({ title: "Trop long", text: `${words(150)}.\n\n`.repeat(40) }),
        readPdf: async () => ({ title: "", text: "" }),
      });
      const refused = await prisma.knowledgeSource.findUniqueOrThrow({ where: { id: source.id } });
      assert.equal(refused.status, "FAILED");
      assert.equal(refused.errorCode, "WORD_LIMIT");
      assert.equal(await prisma.knowledgeEntry.count({ where: { sourceId: source.id } }), 0);

      await prisma.knowledgeSource.delete({ where: { id: source.id } });
      await prisma.knowledgeEntry.deleteMany({ where: { projectId: project.id, title: { startsWith: "Remplissage" } } });
    });

    await t.test("URL sources are public-only, unique and limited per plan", async () => {
      await assert.rejects(addUrlSource(prisma, { ...admin, url: "https://127.0.0.1/admin" }), /pas accessible publiquement/);
      await assert.rejects(addUrlSource(prisma, { ...admin, url: "http://example.com" }), /https/);
      await addUrlSource(prisma, { ...admin, url: "https://example.com/livraison#haut" });
      await assert.rejects(addUrlSource(prisma, { ...admin, url: "https://example.com/livraison" }), /déjà importée/);
      await addUrlSource(prisma, { ...admin, url: "https://example.com/retours" });
      await addUrlSource(prisma, { ...admin, url: "https://example.com/faq" });
      await addUrlSource(prisma, { ...admin, url: "https://example.com/contact" });
      await addUrlSource(prisma, { ...admin, url: "https://example.com/cgv" });
      // Starter : 5 documents (PDF et pages web confondus), comptés sous verrou du projet.
      await assert.rejects(addUrlSource(prisma, { ...admin, url: "https://example.com/plus" }), /Limite de 5 documents/);
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
      // The source limit (5) is already reached by the URL test.
      await assert.rejects(
        addPdfSource(prisma, { ...admin, fileName: "x.pdf", bytes: Buffer.from("%PDF-1.4") }, storage),
        /Limite de 5 documents/,
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
