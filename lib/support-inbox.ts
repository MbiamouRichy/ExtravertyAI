import { z } from "zod";
import type { PrismaClient } from "../src/generated/prisma/client";
import { isVerificationText, receiveVerificationMessage } from "./phone-verification";

/**
 * Le numéro des codes de vérification sert aussi au support d'ExtravertyAI.
 * Chaque message reçu sur cette instance suit un seul chemin :
 *
 * - un code envoyé par un client est traité par la vérification, qui répond
 *   elle-même ; il n'arrive jamais dans la messagerie et ne réveille pas l'IA ;
 * - un code ou une réponse automatique écrits par notre numéro sont ignorés :
 *   aucun code n'est conservé en clair ;
 * - tout le reste (questions, demandes d'aide) va au projet interne de support.
 */
const Message = z
  .object({
    key: z.object({ fromMe: z.boolean() }).passthrough(),
    message: z
      .object({
        conversation: z.string().optional(),
        extendedTextMessage: z.object({ text: z.string().optional() }).passthrough().optional(),
      })
      .passthrough()
      .nullish(),
  })
  .passthrough();

export type VerificationReply = { digits: string; reply: string };

export async function sortSupportNumberMessages(
  db: Pick<PrismaClient, "phoneVerification">,
  messages: unknown[],
) {
  const replies: VerificationReply[] = [];
  const support: unknown[] = [];
  for (const raw of messages) {
    const parsed = Message.safeParse(raw);
    // Forme inconnue : la messagerie la valide et l'écarte comme pour un client.
    if (!parsed.success) {
      support.push(raw);
      continue;
    }
    const text =
      parsed.data.message?.conversation ??
      parsed.data.message?.extendedTextMessage?.text ??
      "";
    if (parsed.data.key.fromMe) {
      if (!isVerificationText(text)) support.push(raw);
      continue;
    }
    const outcome = await receiveVerificationMessage(db, raw);
    if (outcome) replies.push(outcome);
    else support.push(raw);
  }
  return { replies, support };
}
