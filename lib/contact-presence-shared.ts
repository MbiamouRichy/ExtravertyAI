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

/** Abonnement renouvelé tant que la conversation reste ouverte. */
export const PRESENCE_SUBSCRIBE_EVERY_MS = 4 * 60_000;

export const PRESENCE_LABEL: Record<
  Exclude<ContactPresence, "offline">,
  string
> = {
  online: "en ligne",
  typing: "écrit…",
  recording: "enregistre un vocal…",
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

/** Statuts des contacts individuels d’un événement `presence.update`. */
export function parsePresenceUpdate(data: unknown) {
  const parsed = PresenceUpdateSchema.safeParse(data);
  if (!parsed.success) return [];
  return Object.entries(parsed.data.presences)
    .filter(([jid]) => jid.endsWith("@s.whatsapp.net") || jid.endsWith("@lid"))
    .slice(0, 20)
    .flatMap(([jid, value]) => {
      const presence = mapProviderPresence(value.lastKnownPresence);
      return presence ? [{ remoteJid: jid, presence }] : [];
    });
}
