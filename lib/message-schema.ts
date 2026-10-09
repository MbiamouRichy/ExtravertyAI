import { z } from "zod";

export const MAX_MESSAGE_WORDS = 10_000;
export const MessageContentSchema = z
  .string()
  .trim()
  .min(1, "Écrivez un message avant de l’envoyer.")
  .refine((content) => content.split(/\s+/u).length <= MAX_MESSAGE_WORDS, {
    message: "Ce message est trop long. Réduisez-le à 10 000 mots maximum.",
  });

export const SendChatMessageSchema = z
  .object({
    content: z.union([MessageContentSchema, z.literal("")]),
    attachment: z
      .object({
        token: z.string().min(1).max(3000),
        type: z.enum(["IMAGE", "AUDIO", "VIDEO", "DOCUMENT"]),
        requestId: z.string().uuid(),
      })
      .optional(),
  })
  .refine((data) => !!data.content || !!data.attachment, {
    message: "Écrivez un message ou ajoutez un fichier.",
    path: ["content"],
  })
  .refine(
    (data) =>
      !data.attachment ||
      data.attachment.type === "AUDIO" ||
      data.content.length <= 1024,
    {
      message: "La légende est limitée à 1 024 caractères.",
      path: ["content"],
    },
  )
  .refine((data) => data.attachment?.type !== "AUDIO" || !data.content, {
    message: "Envoyez le texte séparément du fichier audio.",
    path: ["content"],
  });
