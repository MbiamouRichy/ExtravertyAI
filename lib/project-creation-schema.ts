import { z } from "zod";
import {
  getCountries,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js/max";

export const PhoneCountrySchema = z.enum(getCountries(), {
  error: "Choisissez un pays.",
});
const nameSchema = z
  .string()
  .trim()
  .min(3, "Utilisez au moins 3 caractères.")
  .max(80, "Utilisez au maximum 80 caractères.");
const planSchema = z.enum(["starter", "business", "pro"]);
const phoneTextSchema = z
  .string()
  .trim()
  .min(1, "Saisissez votre numéro WhatsApp.")
  .max(40, "Ce numéro est trop long.");

export function parseProjectPhone(value: string, country?: CountryCode) {
  // Reject free text and extensions instead of silently extracting a number.
  if (!/^[+\d\s().-]+$/.test(value) || value.length > 40) return undefined;
  const phone = parsePhoneNumberFromString(value, {
    defaultCountry: country,
    extract: false,
  });
  if (!phone?.isValid() || phone.ext || (country && phone.country !== country))
    return undefined;
  return phone;
}

export const ProjectCreationFormSchema = z
  .object({
    name: nameSchema,
    country: PhoneCountrySchema,
    numero: phoneTextSchema,
    plan: planSchema,
  })
  .superRefine((values, ctx) => {
    if (!parseProjectPhone(values.numero, values.country)) {
      ctx.addIssue({
        code: "custom",
        path: ["numero"],
        message: "Saisissez un numéro valide pour le pays sélectionné.",
      });
    }
  });

export const ProjectCheckoutSchema = z.object({
  name: nameSchema,
  numero: phoneTextSchema.transform((value, ctx) => {
    const phone = parseProjectPhone(
      value.startsWith("+") ? value : `+${value}`,
    );
    if (!phone) {
      ctx.addIssue({
        code: "custom",
        message: "Saisissez un numéro international valide.",
      });
      return z.NEVER;
    }
    return phone.number;
  }),
  plan: planSchema,
});

export type ProjectCreationFormValues = z.infer<
  typeof ProjectCreationFormSchema
>;
export type ProjectCheckoutInput = z.input<typeof ProjectCheckoutSchema>;
