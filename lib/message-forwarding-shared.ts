import { z } from "zod";

// Règles du transfert d'un message, partagées par le serveur et le navigateur.

export const FORWARD_LIMITS = {
  /** Conversations au plus par transfert : protège le numéro contre l'envoi en masse. */
  maxTargets: 10,
  /** Conversations proposées par recherche. */
  searchResults: 30,
} as const;

/** Source des messages transférés (graphique des origines, exports, mention dans la bulle). */
export const FORWARD_SOURCE = "forwarded";

/** Conversation proposée comme destination, avec l'état de sa fenêtre de 24 h. */
export type ForwardTarget = {
  id: string;
  name: string;
  avatarUrl: string | null;
  /** Fin de la fenêtre de 24 h de WhatsApp ; null si elle est fermée. */
  windowClosesAt: string | null;
};

export const ForwardFormSchema = z.object({
  contactIds: z
    .array(z.string().cuid())
    .min(1, "Choisissez au moins une conversation.")
    .max(FORWARD_LIMITS.maxTargets, `${FORWARD_LIMITS.maxTargets} conversations au plus par transfert.`),
});
export type ForwardFormValues = z.infer<typeof ForwardFormSchema>;
