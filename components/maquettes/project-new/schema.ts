import { z } from "zod";

import {
  PhoneCountrySchema,
  parseProjectPhone,
} from "@/lib/project-creation-schema";

import { SETUP_LIMITS, type WizardStepId } from "./data";

const ALLOWED_PORTS = new Set(["", "443", "8443"]);
const BLOCKED_HOST_SUFFIXES = [
  ".localhost",
  ".local",
  ".internal",
  ".home.arpa",
  ".lan",
];

export const SOURCE_URL_ERROR =
  "Saisissez une adresse publique en https://, par exemple https://maboutique.com/livraison.";

/**
 * Client-side mirror of `parsePublicUrl` (lib/safe-fetch) for immediate
 * feedback only. The server re-validates and checks DNS before any fetch;
 * IP literals are refused here outright to keep the message simple.
 */
export function parseSourceUrl(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    !ALLOWED_PORTS.has(url.port) ||
    !host.includes(".") ||
    host.includes(":") ||
    /^\d+(\.\d+){3}$/.test(host) ||
    BLOCKED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))
  ) {
    return null;
  }
  url.hash = "";
  return url;
}

export const KnowledgeSourceSchema = z.object({
  id: z.string().min(1).max(64),
  kind: z.enum(["pdf", "url"]),
  /** File name or host + path, rendered as text only. */
  label: z.string().min(1).max(200),
  /** File size or host name. */
  detail: z.string().max(200),
  /** Duplicate key: normalized URL, or name + size + last modification. */
  ref: z.string().max(SETUP_LIMITS.urlMaxLength + 64),
  addedAt: z.number().int().nonnegative(),
});

export type KnowledgeSource = z.infer<typeof KnowledgeSourceSchema>;

export const ProjectWizardSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(3, "Utilisez au moins 3 caractères.")
      .max(80, "Utilisez au maximum 80 caractères."),
    description: z
      .string()
      .trim()
      .min(20, "Décrivez votre activité en une phrase (20 caractères minimum).")
      .max(500, "Restez sous 500 caractères : l’essentiel suffit."),
    language: z.enum(["auto", "fr", "en"], { error: "Choisissez une langue." }),
    country: PhoneCountrySchema,
    numero: z
      .string()
      .trim()
      .min(1, "Saisissez votre numéro WhatsApp.")
      .max(40, "Ce numéro est trop long."),
    connectionMethod: z.enum(["qr", "code"]),
    agentName: z
      .string()
      .trim()
      .min(2, "Donnez un nom à votre agent.")
      .max(60, "Utilisez au maximum 60 caractères."),
    tone: z.enum(["warm", "professional", "direct"], {
      error: "Choisissez un ton.",
    }),
    useEmojis: z.boolean(),
    humanHandover: z.boolean(),
    sources: z
      .array(KnowledgeSourceSchema)
      .max(
        SETUP_LIMITS.sources,
        `${SETUP_LIMITS.sources} documents maximum pendant la configuration.`,
      ),
    /** Draft input of the URL importer, never submitted on its own. */
    sourceUrl: z
      .string()
      .trim()
      .max(SETUP_LIMITS.urlMaxLength, "Cette adresse est trop longue.")
      .refine(
        (value) => value === "" || parseSourceUrl(value) !== null,
        SOURCE_URL_ERROR,
      ),
  })
  .superRefine((values, ctx) => {
    if (values.numero && !parseProjectPhone(values.numero, values.country)) {
      ctx.addIssue({
        code: "custom",
        path: ["numero"],
        message: "Saisissez un numéro valide pour le pays sélectionné.",
      });
    }
  });

export type ProjectWizardValues = z.infer<typeof ProjectWizardSchema>;

export const WIZARD_DEFAULTS: ProjectWizardValues = {
  name: "",
  description: "",
  language: "auto",
  country: "FR",
  numero: "",
  connectionMethod: "qr",
  agentName: "Assistant",
  tone: "warm",
  useEmojis: false,
  humanHandover: true,
  sources: [],
  sourceUrl: "",
};

/** Fields validated before leaving each step. */
export const STEP_FIELDS: Record<
  WizardStepId,
  ReadonlyArray<keyof ProjectWizardValues>
> = {
  essentials: ["name", "description", "language"],
  whatsapp: ["country", "numero", "connectionMethod"],
  agent: ["agentName", "tone", "useEmojis", "humanHandover", "sources", "sourceUrl"],
  launch: [],
};
