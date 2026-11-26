import { z } from "zod";
import type { MessageType, PrismaClient } from "../src/generated/prisma/client";
import { broadcastKeyword } from "./broadcast-shared";
import { looksLikePhoneNumber } from "./chat-privacy";
import { isPrivateJid, readIncoming } from "./evolution-ingestion";
import { isVerificationText } from "./phone-verification";

/**
 * Rattrapage des messages WhatsApp qu’un webhook perdu n’a jamais apportés
 * (site injoignable, DNS en cours de changement…). Evolution les a gardés :
 * on les recopie dans la messagerie, à leur heure d’origine.
 *
 * Ce n’est pas un nouveau passage du webhook :
 * - aucun message rattrapé ne réveille l’IA, qui répondrait des heures après ;
 * - aucun événement d’intégration n’est émis (pas de webhook ni de ligne
 *   Google Sheets en retard) ;
 * - une réponse écrite depuis le téléphone met l’IA en pause sur la
 *   conversation, comme en direct, sauf si l’IA y a été réactivée depuis ;
 * - un STOP reçu pendant la panne retire le contact des diffusions ;
 * - Evolution garde souvent deux copies d’un message : l’une porte le nom
 *   WhatsApp, l’autre l’identifiant chiffré du @lid. Seul un vrai nom est
 *   recopié, et il complète un contact resté sans nom ;
 * - un message déjà présent, ou encore en cours de rapprochement avec un envoi
 *   de l’application, n’est jamais recréé : relancer le rattrapage est sans effet ;
 * - sur le numéro des codes, rien de ce qui ressemble à une vérification n’est
 *   recopié (aucun code n’est conservé en clair).
 */

/** Fenêtre la plus longue qu’un rattrapage accepte. */
export const BACKFILL_MAX_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

const Timestamp = z.union([
  z.number().int().positive(),
  z.string().regex(/^\d{1,12}$/).transform(Number),
]);

const StoredRecord = z
  .object({ messageTimestamp: Timestamp })
  .passthrough();

const SIX_DIGITS = /(?<!\d)\d{6}(?!\d)/;

export type BackfillReport = {
  /** Messages lus chez Evolution, toutes conversations confondues. */
  read: number;
  /** Dans la fenêtre demandée. */
  inWindow: number;
  /** Même message enregistré deux fois par Evolution (numéro et @lid). */
  duplicates: number;
  /** Groupes, statuts, format inconnu ou message vide. */
  ignored: number;
  /** Codes de vérification et leurs réponses, jamais recopiés. */
  verification: number;
  /** Déjà dans la messagerie. */
  alreadyInApp: number;
  /** Envoi de l’application encore en cours de rapprochement : laissé au worker. */
  pending: number;
  /** Messages des clients recopiés (ou à recopier, à blanc). */
  clientMessages: number;
  /** Réponses écrites depuis le téléphone recopiées (ou à recopier). */
  phoneReplies: number;
  /** Conversations concernées. */
  conversations: number;
  /** Contacts qui n’existaient pas encore. */
  newContacts: number;
  /** Conversations où l’IA passe en pause à cause d’une réponse du téléphone. */
  aiPaused: number;
  /** Contacts existants sans nom WhatsApp, complétés. */
  namesCompleted: number;
};

type ContactState = {
  /** Absent à blanc pour un contact que le rattrapage créerait. */
  id: string | null;
  aiActive: boolean;
  lastMessageAt: Date | null;
  resolvedAt: Date | null;
  broadcastOptOutAt: Date | null;
};

type Candidate = {
  evolutionId: string;
  remoteJid: string;
  fromMe: boolean;
  text: string;
  type: MessageType;
  at: Date;
};

export async function backfillEvolutionMessages(
  db: PrismaClient,
  input: {
    projectId: string;
    /** Instance des codes de vérification (projet interne de support). */
    supportNumber: boolean;
    /** Messages tels que les renvoie Evolution, du plus récent au plus ancien. */
    records: unknown[];
    since: Date;
    until: Date;
    /** Sans `apply`, rien n’est écrit : le rapport dit ce qui serait fait. */
    apply: boolean;
  },
): Promise<BackfillReport> {
  const { projectId, supportNumber, since, until, apply } = input;
  if (!(since < until) || until.getTime() - since.getTime() > BACKFILL_MAX_WINDOW_MS)
    throw new Error("Fenêtre de rattrapage invalide.");
  const report: BackfillReport = {
    read: input.records.length,
    inWindow: 0,
    duplicates: 0,
    ignored: 0,
    verification: 0,
    alreadyInApp: 0,
    pending: 0,
    clientMessages: 0,
    phoneReplies: 0,
    conversations: 0,
    newContacts: 0,
    aiPaused: 0,
    namesCompleted: 0,
  };

  // Ordre chronologique ; à la même seconde, l’ordre d’Evolution inversé.
  const ordered = [...input.records]
    .reverse()
    .map((raw) => ({ raw, stored: StoredRecord.safeParse(raw) }))
    .sort((a, b) =>
      a.stored.success && b.stored.success
        ? a.stored.data.messageTimestamp - b.stored.data.messageTimestamp
        : 0,
    );
  const seen = new Set<string>();
  const candidates: Candidate[] = [];
  // Dernier vrai nom WhatsApp de chaque client, doublons compris.
  const names = new Map<string, string>();
  const perSecond = new Map<number, number>();
  for (const { raw, stored } of ordered) {
    if (!stored.success) {
      report.ignored++;
      continue;
    }
    const seconds = stored.data.messageTimestamp;
    if (seconds * 1000 < since.getTime() || seconds * 1000 > until.getTime()) continue;
    report.inWindow++;
    let read: ReturnType<typeof readIncoming>;
    try {
      read = readIncoming(raw);
    } catch {
      report.ignored++;
      continue;
    }
    const { msg, text, type } = read;
    if (!isPrivateJid(msg.key.remoteJid) || !msg.message || type === "OTHER") {
      report.ignored++;
      continue;
    }
    const pushName = msg.pushName?.trim().slice(0, 250);
    if (!msg.key.fromMe && pushName && !looksLikePhoneNumber(pushName))
      names.set(msg.key.remoteJid, pushName);
    if (seen.has(msg.key.id)) {
      report.duplicates++;
      continue;
    }
    seen.add(msg.key.id);
    if (
      supportNumber &&
      (msg.key.fromMe ? isVerificationText(text) : SIX_DIGITS.test(text))
    ) {
      report.verification++;
      continue;
    }
    // Plusieurs messages à la même seconde gardent leur ordre dans le fil.
    const rank = perSecond.get(seconds) ?? 0;
    perSecond.set(seconds, rank + 1);
    candidates.push({
      evolutionId: msg.key.id,
      remoteJid: msg.key.remoteJid,
      fromMe: msg.key.fromMe,
      text,
      type,
      at: new Date(seconds * 1000 + Math.min(rank, 999)),
    });
  }

  const conversations = new Set<string>();
  const newContacts = new Set<string>();
  const paused = new Set<string>();
  // À blanc : l’état que les écritures auraient produit, pour un rapport juste.
  const simulated = new Map<string, ContactState>();

  // Contacts déjà là mais sans nom (copie chiffrée gardée, par exemple) :
  // complétés avant le reste, pour un rapport identique à blanc et pour de bon.
  for (const [remoteJid, name] of names) {
    const completed = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM project WHERE id = ${projectId} FOR UPDATE`;
      const contact = await tx.contact.findUnique({
        where: { projectId_remoteJid: { projectId, remoteJid } },
        select: { id: true, pushName: true },
      });
      if (!contact || (contact.pushName?.trim() && !looksLikePhoneNumber(contact.pushName)))
        return false;
      if (apply)
        await tx.contact.update({ where: { id: contact.id }, data: { pushName: name } });
      return true;
    });
    if (completed) report.namesCompleted++;
  }

  for (const candidate of candidates) {
    const outcome = await db.$transaction(
      async (tx) => {
        // Même verrou que le webhook et le rapprochement des envois.
        await tx.$queryRaw`SELECT id FROM project WHERE id = ${projectId} FOR UPDATE`;
        const exists = await tx.message.findUnique({
          where: { projectId_evolutionId: { projectId, evolutionId: candidate.evolutionId } },
          select: { id: true },
        });
        if (exists) return "alreadyInApp" as const;
        if (candidate.fromMe) {
          const [receipt, job] = await Promise.all([
            tx.providerReceipt.findUnique({
              where: {
                projectId_providerId: { projectId, providerId: candidate.evolutionId },
              },
              select: { id: true },
            }),
            tx.outboundJob.findFirst({
              where: { projectId, providerMessageId: candidate.evolutionId },
              select: { id: true },
            }),
          ]);
          if (receipt || job) return "pending" as const;
        }
        const where = {
          projectId_remoteJid: { projectId, remoteJid: candidate.remoteJid },
        };
        const before: ContactState | null =
          simulated.get(candidate.remoteJid) ??
          (await tx.contact.findUnique({
            where,
            select: {
              id: true,
              aiActive: true,
              lastMessageAt: true,
              resolvedAt: true,
              broadcastOptOutAt: true,
            },
          }));
        if (!before) newContacts.add(candidate.remoteJid);
        conversations.add(candidate.remoteJid);
        // Une réactivation de l’IA après cette réponse l’emporte sur elle.
        const reenabled =
          candidate.fromMe && before?.id
            ? await tx.contactEvent.findFirst({
                where: {
                  contactId: before.id,
                  type: "AI_ENABLED",
                  createdAt: { gt: candidate.at },
                },
                select: { id: true },
              })
            : null;
        const pause = candidate.fromMe && !reenabled;
        if (pause && before?.aiActive) paused.add(candidate.remoteJid);
        // Un STOP reçu pendant la panne est respecté ; un START ancien n’est
        // pas rejoué, il pourrait contredire un STOP plus récent.
        const optOut =
          !candidate.fromMe &&
          candidate.type === "TEXT" &&
          broadcastKeyword(candidate.text) === "OPT_OUT" &&
          !before?.broadcastOptOutAt;

        if (!apply) {
          simulated.set(candidate.remoteJid, {
            id: before?.id ?? null,
            aiActive: pause ? false : (before?.aiActive ?? true),
            lastMessageAt: candidate.at,
            resolvedAt: before?.resolvedAt ?? null,
            broadcastOptOutAt: optOut ? candidate.at : (before?.broadcastOptOutAt ?? null),
          });
          return candidate.fromMe ? ("phoneReplies" as const) : ("clientMessages" as const);
        }

        const later = !before?.lastMessageAt || before.lastMessageAt < candidate.at;
        const name = names.get(candidate.remoteJid);
        const contact = before
          ? await tx.contact.update({
              where,
              data: {
                ...(later ? { lastMessageAt: candidate.at } : {}),
                ...(!candidate.fromMe && later && name ? { pushName: name } : {}),
                // Un message client plus récent que la résolution la rouvre.
                ...(!candidate.fromMe && before.resolvedAt && before.resolvedAt < candidate.at
                  ? { resolvedAt: null, resolvedById: null }
                  : {}),
                ...(pause ? { aiActive: false, aiVersion: { increment: 1 } } : {}),
                ...(optOut ? { broadcastOptOutAt: candidate.at } : {}),
              },
              select: { id: true },
            })
          : await tx.contact.create({
              data: {
                projectId,
                remoteJid: candidate.remoteJid,
                phone: candidate.remoteJid.split("@")[0],
                ...(name ? { pushName: name } : {}),
                lastMessageAt: candidate.at,
                ...(pause ? { aiActive: false, aiVersion: 1 } : {}),
                ...(optOut ? { broadcastOptOutAt: candidate.at } : {}),
              },
              select: { id: true },
            });
        if (pause && before?.aiActive)
          await tx.contactEvent.create({
            data: {
              projectId,
              contactId: contact.id,
              type: "AI_PAUSED_FROM_PHONE",
              createdAt: new Date(candidate.at.getTime() - 1),
            },
          });
        if (optOut)
          await tx.contactEvent.create({
            data: {
              projectId,
              contactId: contact.id,
              type: "BROADCAST_OPT_OUT",
              createdAt: candidate.at,
            },
          });
        await tx.message.create({
          data: candidate.fromMe
            ? {
                projectId,
                contactId: contact.id,
                evolutionId: candidate.evolutionId,
                content:
                  candidate.text ||
                  (candidate.type === "TEXT" ? "[Message WhatsApp]" : `[${candidate.type}]`),
                type: candidate.type,
                senderType: "AGENT",
                fromMe: true,
                status: "SENT",
                source: "whatsapp",
                createdAt: candidate.at,
              }
            : {
                projectId,
                contactId: contact.id,
                evolutionId: candidate.evolutionId,
                content: candidate.text || `[${candidate.type}]`,
                type: candidate.type,
                senderType: "CLIENT",
                fromMe: false,
                status: "DELIVERED",
                source: "whatsapp",
                createdAt: candidate.at,
              },
        });
        return candidate.fromMe ? ("phoneReplies" as const) : ("clientMessages" as const);
      },
      { timeout: 15000 },
    );
    report[outcome]++;
  }
  report.conversations = conversations.size;
  report.newContacts = newContacts.size;
  report.aiPaused = paused.size;
  return report;
}
