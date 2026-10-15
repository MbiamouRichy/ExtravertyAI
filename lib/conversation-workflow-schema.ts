import { z } from "zod";

// Partagé client/serveur : le serveur revalide toujours ces schémas.
export const MAX_PROJECT_TAGS = 20;
export const MAX_CONTACT_TAGS = 10;
export const MAX_NOTE_LENGTH = 2000;

export const TagNameSchema = z
  .string()
  .transform((value) => value.normalize("NFC").replace(/\s+/gu, " ").trim())
  .pipe(
    z
      .string()
      .min(2, "2 caractères minimum.")
      .max(24, "24 caractères maximum.")
      .regex(
        /^[\p{L}\p{N}]+(?:[ -][\p{L}\p{N}]+)*$/u,
        "Lettres, chiffres, espaces et tirets uniquement.",
      ),
  );

export const TagFormSchema = z.object({ name: TagNameSchema });

export const InternalNoteContentSchema = z
  .string()
  .trim()
  .min(1, "Écrivez une note avant de l’ajouter.")
  .max(MAX_NOTE_LENGTH, "Une note est limitée à 2 000 caractères.");

export function tagKey(name: string): string {
  return name.toLocaleLowerCase("fr");
}
