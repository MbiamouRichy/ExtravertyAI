import { z } from "zod";

// Public contact details and form rules of the /contact page.
export const WHATSAPP_NUMBER = "24176205629";
export const PHONE_DISPLAY = "+241 76 20 56 29";
export const PHONE_HREF = "tel:+24176205629";
export const EMAIL = "extravertyai@gmail.com";
export const WHATSAPP_CHAT_URL = `https://wa.me/${WHATSAPP_NUMBER}`;
/** Gabon has a single time zone (WAT, UTC+1), the one of the published number. */
export const TEAM_TIME_ZONE = "Africa/Libreville";

export const NEEDS = [
  { value: "discover", label: "Découvrir la solution" },
  { value: "automate", label: "Automatiser mon activité" },
  { value: "help", label: "Obtenir de l’aide" },
] as const;

export const ContactFormSchema = z.object({
  need: z.enum(["discover", "automate", "help"]),
  name: z
    .string()
    .trim()
    .min(2, "Indiquez votre nom.")
    .max(100, "100 caractères maximum."),
  business: z
    .string()
    .trim()
    .min(2, "Indiquez le nom de votre activité.")
    .max(150, "150 caractères maximum."),
  message: z
    .string()
    .trim()
    .min(10, "Décrivez votre besoin en quelques mots (10 caractères minimum).")
    .max(1500, "1 500 caractères maximum."),
});

export type ContactFormValues = z.infer<typeof ContactFormSchema>;

export const CONTACT_DEFAULTS: ContactFormValues = {
  need: "discover",
  name: "",
  business: "",
  message: "",
};

export function needLabel(need: ContactFormValues["need"]) {
  return NEEDS.find((item) => item.value === need)?.label ?? "";
}

/** Exactly the text the live page pre-fills in WhatsApp. */
export function buildWhatsAppMessage(values: ContactFormValues) {
  return `Bonjour ExtravertyAI !\nJe m'appelle ${values.name.trim()}, de ${values.business.trim()}.\nMon besoin : ${needLabel(values.need)}.\n${values.message.trim()}`;
}

export const NEXT_STEPS = [
  {
    title: "Vous relisez",
    text: "Votre message s’ouvre dans WhatsApp, prêt à être envoyé. Rien n’est enregistré avant.",
  },
  {
    title: "Nous répondons",
    text: "Un membre de l’équipe vous répond directement sur WhatsApp, pas un robot de tri.",
  },
  {
    title: "On avance ensemble",
    text: "Démo, configuration ou aide : nous partons de votre quotidien et de vos clients.",
  },
] as const;

export const SHORTCUTS = [
  { label: "Déjà client ?", title: "Accéder à mon espace", href: "/projects" },
  { label: "Avant de nous écrire", title: "Voir la démo en direct", href: "/#demo" },
  { label: "Budget", title: "Comparer les offres", href: "/#tarifs" },
] as const;
