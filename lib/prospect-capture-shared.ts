import { z } from "zod";

/**
 * Capture IA : informations que le prospect donne de lui-même dans la
 * conversation (nom, e-mail, ville…). Partagé par le serveur, la fiche contact
 * et le formulaire de correction : aucun import serveur ici.
 *
 * La liste des champs est fermée. L’IA ne peut rien relever d’autre, et
 * chaque valeur est revérifiée côté serveur avant d’être enregistrée.
 */
export const CAPTURE_FIELD_KEYS = [
  "fullName",
  "email",
  "phone",
  "city",
  "address",
  "company",
] as const;
export type CaptureFieldKey = (typeof CAPTURE_FIELD_KEYS)[number];

export const CAPTURE_FIELDS: Record<
  CaptureFieldKey,
  { label: string; max: number; placeholder: string }
> = {
  fullName: { label: "Nom", max: 80, placeholder: "Ex. Aïcha Ndong" },
  email: { label: "E-mail", max: 254, placeholder: "Ex. aicha@exemple.com" },
  phone: { label: "Autre numéro", max: 24, placeholder: "Ex. +241 77 12 34 56" },
  city: { label: "Ville", max: 80, placeholder: "Ex. Libreville" },
  address: { label: "Adresse", max: 160, placeholder: "Ex. Quartier Louis, près de la pharmacie" },
  company: { label: "Entreprise", max: 100, placeholder: "Ex. Boutique Elo" },
};

/** `ai` : relevé dans un message du prospect. `team` : saisi par un membre, l’IA ne le remplace pas. */
export type CaptureOrigin = "ai" | "team";

export type CapturedField = {
  key: CaptureFieldKey;
  value: string;
  origin: CaptureOrigin;
  /** Date de la dernière modification. */
  at: string;
};

/** Ce que reçoit le navigateur : champs dans l’ordre de `CAPTURE_FIELD_KEYS`. */
export type ProspectCaptureView = { fields: CapturedField[] };

// Caractères de contrôle et d’inversion de sens : jamais affichés, ils
// pourraient maquiller une adresse e-mail ou un numéro.
const INVISIBLE = /[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁩﻿]/g;

/** Texte nettoyé (espaces regroupés) ou null s’il est vide ou trop long. */
export function cleanCaptureText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(INVISIBLE, " ").replace(/\s+/g, " ").trim();
  return text && text.length <= max ? text : null;
}

const EmailSchema = z.string().email();

/** Adresse e-mail en minuscules, ou null si elle est invalide. */
export function normalizeCaptureEmail(value: unknown): string | null {
  const text = cleanCaptureText(value, CAPTURE_FIELDS.email.max)?.toLowerCase();
  return text && !/\s/.test(text) && EmailSchema.safeParse(text).success ? text : null;
}

export function phoneDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/** Numéro tel que saisi (chiffres, espaces, +, points, tirets, parenthèses), 8 à 15 chiffres. */
export function normalizeCapturePhone(value: unknown): string | null {
  const text = cleanCaptureText(value, CAPTURE_FIELDS.phone.max);
  if (!text || !/^\+?[\d\s().-]+$/.test(text)) return null;
  const digits = phoneDigits(text);
  return digits.length >= 8 && digits.length <= 15 ? text : null;
}

/** Une valeur de champ normalisée, ou null si elle est invalide. */
export function normalizeCaptureValue(key: CaptureFieldKey, value: unknown): string | null {
  if (key === "email") return normalizeCaptureEmail(value);
  if (key === "phone") return normalizeCapturePhone(value);
  const text = cleanCaptureText(value, CAPTURE_FIELDS[key].max);
  // Aucun champ texte n’est fait que de chiffres ou de ponctuation : ce serait
  // un code, un numéro de carte ou un identifiant, pas une ville ni un nom.
  return text && /\p{L}/u.test(text) ? text : null;
}

const StoredFieldSchema = z.object({
  value: z.string(),
  origin: z.enum(["ai", "team"]),
  at: z.string().datetime(),
});

export type StoredCaptureFields = Partial<
  Record<CaptureFieldKey, z.infer<typeof StoredFieldSchema>>
>;

/** Lit la colonne JSON : toute entrée inconnue ou invalide est ignorée. */
export function readStoredCapture(raw: unknown): StoredCaptureFields {
  const fields: StoredCaptureFields = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fields;
  for (const key of CAPTURE_FIELD_KEYS) {
    const parsed = StoredFieldSchema.safeParse((raw as Record<string, unknown>)[key]);
    if (!parsed.success) continue;
    const value = normalizeCaptureValue(key, parsed.data.value);
    if (value) fields[key] = { ...parsed.data, value };
  }
  return fields;
}

export function captureView(raw: unknown): ProspectCaptureView {
  const stored = readStoredCapture(raw);
  return {
    fields: CAPTURE_FIELD_KEYS.flatMap((key) => {
      const field = stored[key];
      return field ? [{ key, ...field }] : [];
    }),
  };
}

function optionalField(key: CaptureFieldKey, message: string) {
  return z
    .string()
    .max(CAPTURE_FIELDS[key].max, `${CAPTURE_FIELDS[key].max} caractères au maximum.`)
    .refine((value) => !value.trim() || normalizeCaptureValue(key, value) !== null, message);
}

/** Formulaire de correction de l’équipe : un champ vide retire l’information. */
export const CaptureEditSchema = z.object({
  fullName: optionalField("fullName", "Saisissez un nom, avec au moins une lettre."),
  email: optionalField("email", "Saisissez une adresse e-mail valide."),
  phone: optionalField("phone", "Saisissez un numéro de 8 à 15 chiffres."),
  city: optionalField("city", "Saisissez une ville, avec au moins une lettre."),
  address: optionalField("address", "Saisissez une adresse, avec au moins une lettre."),
  company: optionalField("company", "Saisissez un nom d’entreprise, avec au moins une lettre."),
});
export type CaptureEditValues = z.infer<typeof CaptureEditSchema>;

/** Valeurs du formulaire à partir de ce qui est affiché. */
export function captureFormValues(view: ProspectCaptureView | null | undefined): CaptureEditValues {
  const values = Object.fromEntries(CAPTURE_FIELD_KEYS.map((key) => [key, ""])) as CaptureEditValues;
  for (const field of view?.fields ?? []) values[field.key] = field.value;
  return values;
}
