import { z } from "zod";

/** Statut WhatsApp d’un prospect, jamais enregistré : uniquement diffusé en direct. */
export type ContactPresence = "online" | "typing" | "recording" | "offline";

export const CONTACT_PRESENCE_EVENT = "contact.presence";

export const ContactPresenceEventSchema = z.object({
  contactId: z.string().min(1).max(64),
  presence: z.enum(["online", "typing", "recording", "offline"]),
});

/** Sans nouvelle de WhatsApp, un statut n’est plus affiché après ce délai. */
export const PRESENCE_TTL_MS: Record<
  Exclude<ContactPresence, "offline">,
  number
> = {
  online: 2 * 60_000,
  typing: 25_000,
  recording: 25_000,
};

/** Conversations de la liste suivies en même temps, les plus récentes d’abord. */
export const PRESENCE_MAX_CONTACTS = 8;

/** Abonnement renouvelé tant que la conversation reste ouverte. */
export const PRESENCE_SUBSCRIBE_EVERY_MS = 4 * 60_000;

export const PRESENCE_LABEL: Record<
  Exclude<ContactPresence, "offline">,
  string
> = {
  online: "En ligne",
  typing: "Écrit…",
  recording: "Enregistre un vocal…",
};

/** Correspondance des états Baileys (lastKnownPresence). */
export function mapProviderPresence(value: unknown): ContactPresence | null {
  switch (value) {
    case "available":
    // « paused » : a cessé d’écrire, mais reste dans la conversation.
    case "paused":
      return "online";
    case "composing":
      return "typing";
    case "recording":
      return "recording";
    case "unavailable":
      return "offline";
    default:
      return null;
  }
}

const PresenceUpdateSchema = z.object({
  id: z.string().max(250).optional(),
  presences: z.record(
    z.string().max(250),
    z
      .object({ lastKnownPresence: z.string().max(40).optional() })
      .passthrough(),
  ),
});

/**
 * Numéro et @lid d’un même contact, lus sur les discussions Evolution : ses
 * messages peuvent porter l’un quand sa présence arrive avec l’autre.
 */
export function jidAliasesFromChats(chats: unknown) {
  const aliases = new Map<string, string>();
  const parsed = z
    .array(
      z.object({
        lastMessage: z
          .object({
            key: z
              .object({
                remoteJid: z.string().max(250).optional(),
                remoteJidAlt: z.string().max(250).optional(),
              })
              .nullish(),
          })
          .nullish(),
      }),
    )
    .safeParse(chats);
  for (const chat of parsed.success ? parsed.data : []) {
    const { remoteJid, remoteJidAlt } = chat.lastMessage?.key ?? {};
    if (!remoteJid || !remoteJidAlt) continue;
    if (!isContactJid(remoteJid) || !isContactJid(remoteJidAlt)) continue;
    aliases.set(remoteJid, remoteJidAlt);
    aliases.set(remoteJidAlt, remoteJid);
  }
  return aliases;
}

const isContactJid = (jid: string) =>
  jid.endsWith("@s.whatsapp.net") || jid.endsWith("@lid");

/** Statuts des contacts individuels d’un événement `presence.update`. */
export function parsePresenceUpdate(data: unknown) {
  const parsed = PresenceUpdateSchema.safeParse(data);
  if (!parsed.success) return [];
  const entries = Object.entries(parsed.data.presences)
    .filter(([jid]) => isContactJid(jid))
    .slice(0, 20);
  return entries.flatMap(([jid, value]) => {
      const presence = mapProviderPresence(value.lastKnownPresence);
      if (!presence) return [];
      // WhatsApp peut désigner un même contact par son numéro ou son @lid.
      const alias =
        entries.length === 1 &&
        parsed.data.id &&
        parsed.data.id !== jid &&
        isContactJid(parsed.data.id)
          ? [{ remoteJid: parsed.data.id, presence }]
          : [];
      return [{ remoteJid: jid, presence }, ...alias];
    });
}
