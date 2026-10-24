import { Briefcase, HeartHandshake, Zap, type LucideIcon } from "lucide-react";

import { AGENT_TONES } from "@/lib/agent-config";
import { PLAN_FEATURES } from "@/lib/plan-features";

export const WIZARD_STEPS = [
  {
    id: "essentials",
    label: "Projet",
    title: "Les bases de votre projet",
    description:
      "Un nom, quelques mots sur votre activité et la langue de vos clients.",
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    title: "Connectez votre numéro",
    description:
      "Le numéro sur lequel vos clients vous écrivent déjà. Rien à migrer, rien à installer.",
  },
  {
    id: "agent",
    label: "Agent IA",
    title: "Donnez-lui une voix et du savoir",
    description:
      "Le ton de votre agent et les documents sur lesquels il s’appuie pour répondre.",
  },
  {
    id: "launch",
    label: "Lancement",
    title: "Vérifiez, puis lancez",
    description: "Un dernier coup d’œil. Tout reste modifiable après le lancement.",
  },
] as const;

export type WizardStep = (typeof WIZARD_STEPS)[number];
export type WizardStepId = WizardStep["id"];

export const LANGUAGE_OPTIONS = [
  {
    value: "auto",
    label: "Détection automatique",
    hint: "L’agent répond dans la langue du client, en français par défaut.",
  },
  {
    value: "fr",
    label: "Français",
    hint: "L’agent répond toujours en français.",
  },
  {
    value: "en",
    label: "Anglais",
    hint: "L’agent répond toujours en anglais.",
  },
] as const;

export type LanguageId = (typeof LANGUAGE_OPTIONS)[number]["value"];

export type ToneId = (typeof AGENT_TONES)[number]["value"];

const TONE_DETAILS: Record<ToneId, { icon: LucideIcon; sample: string }> = {
  warm: { icon: HeartHandshake, sample: "« Avec plaisir, je m’en occupe ! »" },
  professional: { icon: Briefcase, sample: "« Bien sûr, je vérifie pour vous. »" },
  direct: { icon: Zap, sample: "« Oui. Voici l’essentiel. »" },
};

// Same tones as the real agent settings (lib/agent-config).
export const TONE_OPTIONS = AGENT_TONES.map((tone) => ({
  ...tone,
  ...TONE_DETAILS[tone.value],
}));

export const CONNECTION_METHODS = [
  {
    value: "qr",
    label: "QR code",
    description: "Scannez-le avec le téléphone du numéro.",
  },
  {
    value: "code",
    label: "Code de liaison",
    description: "Saisissez 8 caractères dans WhatsApp.",
  },
] as const;

export type ConnectionMethodId = (typeof CONNECTION_METHODS)[number]["value"];

/**
 * Starter limits: whatever is added during setup stays valid with every plan
 * chosen at checkout. Larger plans raise them afterwards.
 */
export const SETUP_LIMITS = {
  sources: PLAN_FEATURES.starter.knowledgeSources,
  pdfMaxMb: PLAN_FEATURES.starter.pdfMaxMb,
  urlMaxLength: 2048,
} as const;

// Trial terms enforced server-side (stripe-actions trial_period_days).
export const TRIAL_DAYS = 10;

export const DESCRIPTION_EXAMPLES = [
  {
    label: "Boutique en ligne",
    text: "Boutique en ligne de cosmétiques naturels. Livraison en 48 h en France, retours gratuits sous 30 jours.",
  },
  {
    label: "Restaurant",
    text: "Restaurant bistronomique à Lyon, ouvert du mardi au samedi. Réservations, menu du jour et privatisations.",
  },
  {
    label: "Immobilier",
    text: "Agence immobilière à Bordeaux : vente, location et gestion locative. Visites sur rendez-vous.",
  },
] as const;
