import "dotenv/config";
import { randomBytes } from "node:crypto";
import { parseArgs } from "node:util";
import { z } from "zod";
import { paidMessageLimit } from "../lib/billing-quota";
import { ensureInternalQuota } from "../lib/internal-project";
import { ProjectCheckoutSchema } from "../lib/project-creation-schema";
import { sameWhatsAppNumber } from "../lib/whatsapp-number";
import { workerDatabase } from "../workers/shared";

/**
 * Crée le projet interne de support d'ExtravertyAI sur l'instance WhatsApp qui
 * envoie les codes de vérification. Seule voie pour poser `internal` : aucune
 * action de l'application ne l'accepte.
 *
 * À lancer dans le conteneur d'un worker de production (base et Evolution) :
 *   tsx scripts/create-internal-project.ts --owner vous@exemple.com \
 *     --instance NOM_INSTANCE_OTP --numero +241XXXXXXXX [--apply]
 *
 * Sans --apply, rien n'est écrit : le script affiche ce qu'il ferait.
 * Relancé sur un projet interne existant, il complète seulement ce qui manque.
 */

const Args = z.object({
  owner: z.string().trim().toLowerCase().pipe(z.email()),
  instance: z.string().trim().regex(/^[A-Za-z0-9_-]{1,64}$/, "Nom d’instance invalide."),
  numero: ProjectCheckoutSchema.shape.numero,
  name: z.string().trim().min(2).max(60),
  apply: z.boolean(),
});

async function evolutionInstance(instance: string) {
  const base = process.env.EVOLUTION_API_URL?.replace(/\/+$/, "");
  const apikey = process.env.EVOLUTION_API_KEY;
  if (!base || !apikey) throw new Error("EVOLUTION_API_URL ou EVOLUTION_API_KEY manquant.");
  const get = async (path: string) => {
    const response = await fetch(`${base}${path}`, {
      headers: { apikey },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`Evolution a répondu ${response.status} pour l’instance.`);
    return response.json() as Promise<unknown>;
  };
  const name = encodeURIComponent(instance);
  const state = z
    .object({ instance: z.object({ state: z.string() }) })
    .parse(await get(`/instance/connectionState/${name}`)).instance.state.toLowerCase();
  const list = await get(`/instance/fetchInstances?instanceName=${name}`);
  const first = (Array.isArray(list) ? list[0] : list) as Record<string, unknown> | undefined;
  const record = (first?.instance ?? first) as Record<string, unknown> | undefined;
  const owner = record?.ownerJid ?? record?.owner;
  return { state, ownerDigits: typeof owner === "string" ? owner.split("@")[0].split(":")[0] : null };
}

async function main() {
  const { values } = parseArgs({
    options: {
      owner: { type: "string" },
      instance: { type: "string" },
      numero: { type: "string" },
      name: { type: "string", default: "Support ExtravertyAI" },
      apply: { type: "boolean", default: false },
    },
    strict: true,
  });
  const args = Args.parse(values);
  const limit = paidMessageLimit("business");

  // L'instance doit exister, être connectée et appartenir au numéro annoncé :
  // on ne relie jamais un projet interne au WhatsApp de quelqu'un d'autre.
  const evolution = await evolutionInstance(args.instance);
  if (evolution.state !== "open" || !evolution.ownerDigits)
    throw new Error(`Instance « ${args.instance} » non connectée (état : ${evolution.state}).`);
  if (!sameWhatsAppNumber(evolution.ownerDigits, args.numero))
    throw new Error("Le numéro relié à cette instance ne correspond pas à --numero.");

  const prisma = workerDatabase();
  try {
    const owner = await prisma.user.findUnique({
      where: { email: args.owner },
      select: { id: true, emailVerified: true },
    });
    if (!owner?.emailVerified)
      throw new Error("Propriétaire introuvable ou adresse e-mail non vérifiée.");

    const sameInstance = await prisma.project.findUnique({
      where: { instanceName: args.instance },
      select: { id: true, internal: true, deletionPending: true },
    });
    if (sameInstance && !sameInstance.internal)
      throw new Error("Cette instance appartient déjà au projet d’un client : refus.");
    if (sameInstance?.deletionPending)
      throw new Error("Le projet interne existant est en cours de suppression.");
    const otherInternal = await prisma.project.findFirst({
      where: { internal: true, instanceName: { not: args.instance } },
      select: { id: true },
    });
    if (otherInternal)
      throw new Error("Un autre projet interne existe déjà sur une autre instance.");
    const customerOnNumber = await prisma.project.findFirst({
      where: { numero: args.numero, internal: false },
      select: { id: true },
    });
    if (customerOnNumber)
      throw new Error("Un projet client utilise déjà ce numéro : à régler avant de continuer.");

    console.log(
      sameInstance
        ? `Projet interne existant : ${sameInstance.id} (membre et quota vérifiés).`
        : `Création du projet interne « ${args.name} » sur l’instance ${args.instance}.`,
    );
    console.log(`Quota mensuel : ${limit.toLocaleString("fr-FR")} messages (offre Business).`);
    if (!args.apply) {
      console.log("Simulation : relancez avec --apply pour écrire.");
      return;
    }

    const projectId = await prisma.$transaction(async (tx) => {
      const project =
        sameInstance ??
        (await tx.project.create({
          data: {
            name: args.name,
            numero: args.numero,
            instanceName: args.instance,
            instanceToken: randomBytes(32).toString("hex"),
            instanceStatus: "connected",
            internal: true,
            plan: "business",
            status: "active",
            numeroVerifiedAt: new Date(),
          },
          select: { id: true },
        }));
      await tx.projectMembership.upsert({
        where: { userId_projectId: { userId: owner.id, projectId: project.id } },
        create: { userId: owner.id, projectId: project.id, role: "OWNER" },
        update: {},
      });
      return project.id;
    });
    await ensureInternalQuota(prisma, projectId, limit);
    const app = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ?? "";
    console.log(`Projet interne prêt : ${app}/projects/${projectId}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(
    error instanceof z.ZodError
      ? `Paramètres invalides : ${error.issues.map((issue) => `${issue.path.join(".")} ${issue.message}`).join(" ; ")}`
      : error instanceof Error
        ? error.message
        : "Échec inattendu.",
  );
  process.exit(1);
});
