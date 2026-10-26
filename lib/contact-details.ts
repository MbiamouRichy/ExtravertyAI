// Détails de contact exposés à la fiche du chat. Le numéro n’est jamais
// envoyé en clair au navigateur : seule une version masquée l’est ici.

export type ChatContactDetails = {
  firstContactAt: string;
  clientMessages: number;
  source: string;
  maskedPhone: string | null;
};

/** « 24166845039 » → « +241 6•• •• •• 39 ». */
export function maskContactPhone(phone: string | null | undefined): string | null {
  const digits = phone?.replace(/\D/g, "") ?? "";
  if (digits.length < 8 || digits.length > 15) return null;
  return `+${digits.slice(0, 3)} ${digits[3]}•• •• •• ${digits.slice(-2)}`;
}

const SOURCE_LABELS: Record<string, string> = {
  android: "WhatsApp Android",
  ios: "WhatsApp iPhone",
  web: "WhatsApp Web",
  desktop: "WhatsApp Desktop",
  whatsapp: "WhatsApp",
};

/** Appareil depuis lequel le client a écrit en dernier. */
export function contactSourceLabel(source: string | null | undefined): string {
  const key = source?.trim().toLowerCase() ?? "";
  return SOURCE_LABELS[key] ?? "WhatsApp";
}

export type ContactEventKind =
  | "AI_ENABLED"
  | "AI_PAUSED"
  | "AI_PAUSED_BY_REPLY"
  | "AI_PAUSED_FROM_PHONE"
  | "ASSIGNED"
  | "UNASSIGNED"
  | "STAGE_CHANGED"
  | "AI_QUIET"
  | "AI_WOKEN"
  | "BROADCAST_OPT_OUT"
  | "BROADCAST_OPT_IN";

/** Libellé de l’événement affiché au centre de la conversation. */
export function contactEventLabel(
  type: ContactEventKind,
  actorName?: string | null,
  detail?: string | null,
): string {
  const actor = actorName?.trim().split(/\s+/)[0] || "Un membre";
  switch (type) {
    case "ASSIGNED":
      return detail
        ? `${actor} a assigné la conversation à ${detail}`
        : `${actor} a pris la conversation en charge`;
    case "UNASSIGNED":
      return `${actor} a retiré l’assignation`;
    case "STAGE_CHANGED":
      return `${actor} a déplacé le prospect vers « ${detail ?? "une autre étape"} »`;
    case "AI_ENABLED":
      return `Assistant IA réactivé par ${actor}`;
    case "AI_PAUSED":
      return `${actor} a repris la main · IA en pause`;
    case "AI_PAUSED_BY_REPLY":
      return `${actor} a répondu · IA en pause`;
    case "AI_PAUSED_FROM_PHONE":
      return "Réponse depuis le téléphone · IA en pause";
    case "AI_QUIET":
      return detail === "REPEATED"
        ? "Réponse de l’IA retenue : elle répétait un message déjà envoyé"
        : "Fin de conversation · IA en veille jusqu’au prochain vrai message du client";
    case "BROADCAST_OPT_OUT":
      return "Désinscrit des diffusions (STOP)";
    case "BROADCAST_OPT_IN":
      return "Réinscrit aux diffusions (START)";
    case "AI_WOKEN":
      return actorName
        ? `${actor} a réveillé l’IA`
        : "Nouvelle demande du client · l’IA reprend";
  }
}
