import { z } from "zod";

export const MAX_MESSAGE_WORDS = 10_000;
export const MessageContentSchema = z.string().trim()
  .min(1, "Écrivez un message avant de l’envoyer.")
  .refine((content) => content.split(/\s+/u).length <= MAX_MESSAGE_WORDS, {
    message: "Ce message est trop long. Réduisez-le à 10 000 mots maximum.",
  });
