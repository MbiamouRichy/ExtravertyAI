import "dotenv/config";
import { parseArgs } from "node:util";
import { z } from "zod";
import { BACKFILL_MAX_WINDOW_MS, backfillEvolutionMessages } from "../lib/evolution-backfill";
import { isOtpInstance } from "../lib/phone-verification";
import { notifyProject, workerDatabase } from "../workers/shared";

/**
 * Recopie dans la messagerie les messages WhatsApp qu’Evolution a reçus ou
 * envoyés pendant une coupure du webhook (voir lib/evolution-backfill.ts) :
 * messages des clients et réponses écrites depuis le téléphone, à leur heure.
 * L’IA ne répond à aucun d’eux.
 *
 * À lancer dans le conteneur d’un worker de production (base et Evolution) :
 *   tsx scripts/backfill-evolution-messages.ts --instance NOM_INSTANCE \
 *     --since 2026-11-26T00:00:00Z [--until 2026-11-26T12:00:00Z] [--apply]
 *
 * Sans --apply, rien n’est écrit : le script affiche ce qu’il ferait.
 * N’affiche que des nombres : ni contenu de message, ni numéro.
 */

const PAGE_SIZE = 100;
const MAX_PAGES = 100;

const IsoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/, "Date ISO avec fuseau attendue.")
  .transform((value) => new Date(value))
  .refine((date) => !Number.isNaN(date.getTime()), "Date invalide.");

const Args = z
  .object({
    instance: z.string().trim().regex(/^[A-Za-z0-9_-]{1,64}$/, "Nom d’instance invalide."),
    since: IsoDate,
    until: IsoDate.optional(),
    apply: z.boolean(),
  })
  .transform((args) => ({ ...args, until: args.until ?? new Date() }))
  .refine((args) => args.since < args.until, "--since doit précéder --until.")
  .refine((args) => args.until.getTime() <= Date.now() + 60_000, "--until est dans le futur.")
  .refine(
    (args) => args.until.getTime() - args.since.getTime() <= BACKFILL_MAX_WINDOW_MS,
    "Fenêtre de 14 jours au plus.",
  );

const Page = z.object({
  messages: z.object({
    pages: z.number().int().nonnegative(),
    records: z.array(z.unknown()),
  }),
});

const Stamp = z.object({ messageTimestamp: z.union([z.number(), z.string()]) }).passthrough();

/** Messages de l’instance, du plus récent au plus ancien, jusqu’à `since`. */
async function evolutionMessages(instance: string, since: Date) {
  const base = process.env.EVOLUTION_API_URL?.replace(/\/+$/, "");
  const apikey = process.env.EVOLUTION_API_KEY;
  if (!base || !apikey) throw new Error("EVOLUTION_API_URL ou EVOLUTION_API_KEY manquant.");
  const records: unknown[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const response = await fetch(
      `${base}/chat/findMessages/${encodeURIComponent(instance)}`,
      {
        method: "POST",
        headers: { apikey, "Content-Type": "application/json" },
        body: JSON.stringify({ where: {}, page, offset: PAGE_SIZE }),
        signal: AbortSignal.timeout(20_000),
      },
    );
    if (!response.ok) throw new Error(`Evolution a répondu ${response.status}.`);
    const { messages } = Page.parse(await response.json());
    records.push(...messages.records);
    const stamps = messages.records
      .map((record) => Stamp.safeParse(record))
      .filter((stamp) => stamp.success)
      .map((stamp) => Number(stamp.data.messageTimestamp) * 1000)
      .filter(Number.isFinite);
    const oldest = stamps.length ? Math.min(...stamps) : 0;
    if (!messages.records.length || page >= messages.pages || oldest < since.getTime())
      return records;
  }
  throw new Error("Trop de messages à parcourir : réduisez la fenêtre.");
}

async function main() {
  const { values } = parseArgs({
    options: {
      instance: { type: "string" },
      since: { type: "string" },
      until: { type: "string" },
      apply: { type: "boolean", default: false },
    },
    strict: true,
  });
  const parsed = Args.safeParse(values);
  if (!parsed.success) {
    console.error(parsed.error.issues.map((issue) => `- ${issue.message}`).join("\n"));
    process.exitCode = 1;
    return;
  }
  const args = parsed.data;
  const prisma = workerDatabase();
  try {
    const project = await prisma.project.findFirst({
      where: { instanceName: args.instance, deletionPending: false },
      select: { id: true, internal: true },
    });
    // Sur le numéro des codes, seul le projet interne reçoit les messages.
    if (!project || (isOtpInstance(args.instance) && !project.internal))
      throw new Error("Aucun projet actif sur cette instance.");
    // Le projet interne est sur le numéro des codes : ses codes restent filtrés.
    const supportNumber = project.internal || isOtpInstance(args.instance);
    const records = await evolutionMessages(args.instance, args.since);
    const report = await backfillEvolutionMessages(prisma, {
      projectId: project.id,
      supportNumber,
      records,
      since: args.since,
      until: args.until,
      apply: args.apply,
    });
    console.log(JSON.stringify({ mode: args.apply ? "apply" : "dry-run", projectId: project.id, ...report }, null, 2));
    if (args.apply && report.clientMessages + report.phoneReplies > 0)
      await notifyProject(project.id);
    if (!args.apply) console.log("Rien n’a été écrit. Relancez avec --apply pour recopier ces messages.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Rattrapage interrompu.");
  process.exitCode = 1;
});
