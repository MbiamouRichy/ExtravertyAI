import "dotenv/config";
import { randomBytes, randomUUID } from "node:crypto";
import type { Prisma } from "../src/generated/prisma/client";
import { workerDatabase } from "../workers/shared";

/**
 * Données de démonstration du back-office (/admin) sur 24 mois : comptes,
 * projets, essais et mois payés, messages, audience et retours produit.
 *
 * Usage : tsx scripts/seed-admin-demo.ts [--reset] [--remove]
 *   --reset  supprime puis recrée les données de démo
 *   --remove supprime les données de démo sans en recréer
 *
 * Réservé à la base extravertyai_preview (ou ALLOW_DEMO_SEED=1 en local).
 * Tout est marqué : e-mails @demo.extraverty.test, projets « [Démo] »,
 * visiteurs « demo: ». Aucun membre ni abonnement Stripe : aucun worker,
 * e-mail ou facture n'est déclenché.
 */
const DEMO_DOMAIN = "@demo.extraverty.test";
const DEMO_PROJECT = "[Démo] ";
const DEMO_VISITOR = "demo:";
const DAY = 86_400_000;

const FIRST_NAMES = ["Inès", "Paul", "Aïcha", "Moussa", "Clarisse", "Jean", "Fatou", "Hervé", "Nadia", "Yann", "Grâce", "Ousmane"];
const LAST_NAMES = ["Obame", "Ndong", "Mba", "Diallo", "Nguema", "Kouassi", "Traoré", "Essono", "Sow", "Mintsa"];
const COMPANIES = ["Boutique Akanda", "Pharmacie du Port", "Libreville Auto", "Salon Élégance", "Resto Le Baobab", "Clinique Owendo", "Agence Horizon", "Mode Kalinda", "Tech Mbolo", "Immo Glass"];
const COUNTRIES = ["GA", "GA", "GA", "GA", "CM", "CM", "CI", "SN", "FR", "CG", "BE", null];
const BROWSERS = ["Chrome", "Chrome", "Chrome", "Chrome", "Safari", "Safari", "Samsung Internet", "Edge", "Firefox", "Opera"];
const DEVICES = ["mobile", "mobile", "mobile", "mobile", "desktop", "desktop", "tablet"];
const PAGES = ["/", "/", "/", "/tarifs", "/tarifs", "/sign-up", "/sign-in", "/projects", "/projects/:id/chat", "/projects/:id/analytics", "/apropos", "/contact"];
const REFERRERS = ["google.com", "google.com", "facebook.com", "facebook.com", "l.instagram.com", "t.co", "linkedin.com", "wa.me"];
const PLANS = [
  { plan: "starter", limit: 4000 },
  { plan: "starter", limit: 4000 },
  { plan: "pro", limit: 10000 },
  { plan: "business", limit: 25000 },
] as const;
const FEEDBACK = [
  ["BUG", "Le bouton Envoyer ne répond plus quand je joins une image depuis mon téléphone.", "NEW"],
  ["BUG", "La page Rapports met longtemps à charger le lundi matin.", "IN_PROGRESS"],
  ["BUG", "Le QR code expire avant que j'aie le temps de le scanner.", "DONE"],
  ["IDEA", "Pouvoir filtrer les contacts par étiquette dans la messagerie.", "NEW"],
  ["IDEA", "Exporter les diffusions en PDF pour les montrer à mon associé.", "NEW"],
  ["IDEA", "Une application mobile pour répondre plus vite aux clients.", "IN_PROGRESS"],
  ["IDEA", "Programmer une diffusion à une heure précise.", "ARCHIVED"],
  ["PRAISE", "Merci pour les rapports hebdomadaires, très clairs !", "DONE"],
  ["PRAISE", "L'assistant répond mieux que mon ancien standard, mes clients adorent.", "NEW"],
  ["BUG", "Les notes vocales longues ne sont pas toujours transcrites.", "NEW"],
] as const;

// Pseudo-aléatoire reproductible : mêmes données à chaque génération.
let state = 20261026;
const rand = () => ((state = (state * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const pick = <T>(items: readonly T[]) => items[Math.floor(rand() * items.length)];
const cuid = () => `c${randomBytes(12).toString("hex")}`;
const daysAgo = (now: number, days: number, minutes = 0) => new Date(now - days * DAY - minutes * 60_000);

function assertPreviewDatabase() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL manquant.");
  const database = new URL(url).pathname;
  if (database !== "/extravertyai_preview" && process.env.ALLOW_DEMO_SEED !== "1")
    throw new Error(`Refusé : base ${database}. Données de démo réservées à extravertyai_preview.`);
}

type Db = ReturnType<typeof workerDatabase>;

async function removeDemo(db: Db) {
  const projects = await db.project.findMany({
    where: { name: { startsWith: DEMO_PROJECT }, instanceName: { startsWith: "demo-admin-" } },
    select: { id: true },
  });
  // Les périodes, contacts et messages partent avec leur projet (cascade).
  await db.project.deleteMany({ where: { id: { in: projects.map((p) => p.id) } } });
  const feedback = await db.productFeedback.deleteMany({ where: { user: { email: { endsWith: DEMO_DOMAIN } } } });
  const users = await db.user.deleteMany({ where: { email: { endsWith: DEMO_DOMAIN } } });
  const views = await db.pageView.deleteMany({ where: { visitorHash: { startsWith: DEMO_VISITOR } } });
  console.log(`Supprimé : ${projects.length} projets, ${users.count} comptes, ${feedback.count} retours, ${views.count} pages vues.`);
}

async function seed(db: Db) {
  const now = Date.now();

  // Comptes : croissance progressive sur 24 mois.
  const users = Array.from({ length: 180 }, (_, index) => {
    const age = Math.floor(730 * Math.sqrt(rand()));
    const first = pick(FIRST_NAMES);
    const last = pick(LAST_NAMES);
    return {
      id: randomUUID(),
      name: `${first} ${last}`,
      email: `${first}.${last}.${index}`.normalize("NFD").replace(/[^\w.]/g, "").toLowerCase() + DEMO_DOMAIN,
      emailVerified: true,
      createdAt: daysAgo(now, age),
      lastActiveAt: daysAgo(now, Math.floor(age * rand())),
    };
  });
  await db.user.createMany({ data: users });

  // Projets : essai de 7 jours, puis mois payés pour deux tiers d'entre eux.
  let periods = 0;
  let messages = 0;
  for (let index = 0; index < 70; index += 1) {
    const age = Math.floor(720 * Math.sqrt(rand()));
    const offer = pick(PLANS);
    const converts = rand() < 0.62;
    const months = converts ? 1 + Math.floor(rand() * 14) : 0;
    const paidUntil = age - 5 - months * 30;
    const active = converts && paidUntil < 0;
    const projectId = cuid();
    await db.project.create({
      data: {
        id: projectId,
        name: `${DEMO_PROJECT}${pick(COMPANIES)} ${index + 1}`,
        numero: "24100000000",
        instanceName: `demo-admin-${randomUUID()}`,
        plan: offer.plan,
        status: active ? "active" : converts ? "inactive" : "trialing",
        createdAt: daysAgo(now, age),
        // Jamais relu par le worker de facturation.
        billingNextCheckAt: new Date(now + 3650 * DAY),
      },
    });
    const rows: Prisma.QuotaPeriodCreateManyInput[] = [
      {
        projectId,
        key: `trial:demo-${projectId}`,
        kind: "trialing",
        startsAt: daysAgo(now, age),
        endsAt: daysAgo(now, age - 7),
        limit: 150,
        isCurrent: false,
      },
    ];
    for (let month = 0; month < months; month += 1) {
      const start = age - 5 - month * 30;
      if (start < -30) break;
      rows.push({
        projectId,
        key: `cycle:demo-${projectId}:${month}`,
        kind: "active",
        startsAt: daysAgo(now, start),
        endsAt: daysAgo(now, start - 30),
        limit: offer.limit,
        isCurrent: false,
      });
    }
    await db.quotaPeriod.createMany({ data: rows });
    periods += rows.length;

    // Conversations : un contact et des messages répartis sur la vie du projet.
    if (converts) {
      const contact = await db.contact.create({
        data: {
          projectId,
          phone: `24166${100000 + index}`,
          remoteJid: `24166${100000 + index}@s.whatsapp.net`,
          name: "Client démo",
        },
        select: { id: true },
      });
      const volume = Math.round((offer.limit / 400) * months * (0.5 + rand()));
      const data = Array.from({ length: Math.min(volume, 600) }, () => {
        const when = Math.max(0, Math.floor(rand() * Math.min(age, months * 30 + 5)));
        const fromClient = rand() < 0.5;
        return {
          projectId,
          contactId: contact.id,
          content: fromClient ? "Bonjour, vous avez encore ce modèle ?" : "Oui, il est disponible en boutique.",
          senderType: fromClient ? ("CLIENT" as const) : ("BOT" as const),
          fromMe: !fromClient,
          status: "DELIVERED" as const,
          source: fromClient ? "unknown" : "ai",
          createdAt: daysAgo(now, when, Math.floor(rand() * 1440)),
        };
      });
      await db.message.createMany({ data });
      messages += data.length;
    }
  }

  // Audience : visiteurs uniques par jour, en hausse, avec une saisonnalité.
  let views = 0;
  let batch: Prisma.PageViewCreateManyInput[] = [];
  for (let day = 730; day >= 0; day -= 1) {
    const visitors = Math.round(6 + (730 - day) / 25 + 8 * Math.sin(day / 45) ** 2);
    for (let visitor = 0; visitor < visitors; visitor += 1) {
      const hash = `${DEMO_VISITOR}${day}-${visitor}`;
      const country = pick(COUNTRIES);
      const browser = pick(BROWSERS);
      const device = pick(DEVICES);
      const minutes = day === 0 ? Math.floor(rand() * 4) : Math.floor(rand() * 1440);
      const pages = 1 + Math.floor(rand() * 3);
      for (let page = 0; page < pages; page += 1)
        batch.push({
          visitorHash: hash,
          path: pick(PAGES),
          country,
          browser,
          device,
          referrerHost: page === 0 && rand() < 0.45 ? pick(REFERRERS) : null,
          createdAt: daysAgo(now, day, minutes - page * 2),
        });
      if (batch.length >= 2000) {
        await db.pageView.createMany({ data: batch });
        views += batch.length;
        batch = [];
      }
    }
  }
  if (batch.length) await db.pageView.createMany({ data: batch });
  views += batch.length;

  // Retours produit, à différents stades de traitement.
  await db.productFeedback.createMany({
    data: FEEDBACK.map(([kind, message, status], index) => ({
      kind,
      message,
      status,
      contactOk: index % 3 !== 1,
      userId: users[index * 7].id,
      pagePath: pick(["/projects", "/projects/:id/chat", "/projects/:id/reports", "/tarifs"]),
      createdAt: daysAgo(now, index * 4 + 1),
      handledAt: status === "NEW" ? null : daysAgo(now, index * 4),
    })),
  });

  console.log(
    `Créé : ${users.length} comptes, 70 projets, ${periods} périodes, ${messages} messages, ${views} pages vues, ${FEEDBACK.length} retours.`,
  );
}

async function main() {
  assertPreviewDatabase();
  const args = new Set(process.argv.slice(2));
  const db = workerDatabase();
  try {
    if (args.has("--reset") || args.has("--remove")) await removeDemo(db);
    if (args.has("--remove")) return;
    if (await db.user.count({ where: { email: { endsWith: DEMO_DOMAIN } } }))
      throw new Error("Données de démo déjà présentes : relancez avec --reset.");
    await seed(db);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
