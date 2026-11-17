import { z } from "zod";

/**
 * Fiche de l’entreprise remplie au début de la configuration de l’assistant.
 * Partagée par le navigateur (formulaire) et le serveur (validation, stockage,
 * génération du message système) : aucune dépendance serveur ici.
 *
 * Stockage : le nom est celui du projet (`project.name`, « Nom du projet
 * (Entreprise) » à la création) ; activité, secteur et objectifs vont dans
 * `project.businessProfile` ; le site web et les réseaux sociaux forment une
 * entrée « Informations » de la base de connaissances, la seule copie de ces
 * liens, que l’assistant consulte pour répondre.
 */

export const BUSINESS_SECTORS = [
  { value: "retail", label: "Commerce et vente en ligne" },
  { value: "fashion_beauty", label: "Mode, beauté et cosmétiques" },
  { value: "food", label: "Restauration et alimentation" },
  { value: "health", label: "Santé et bien-être" },
  { value: "education", label: "Éducation et formation" },
  { value: "real_estate", label: "Immobilier et construction" },
  { value: "hospitality", label: "Tourisme, hôtellerie et événementiel" },
  { value: "transport", label: "Transport et logistique" },
  { value: "automotive", label: "Automobile" },
  { value: "finance", label: "Banque, assurance et microfinance" },
  { value: "tech", label: "Technologie et télécoms" },
  { value: "b2b_services", label: "Services aux entreprises" },
  { value: "home_services", label: "Artisanat et services à domicile" },
  { value: "nonprofit", label: "Association, ONG ou institution" },
  { value: "other", label: "Autre secteur" },
] as const;
export type BusinessSector = (typeof BUSINESS_SECTORS)[number]["value"];

/** Ce que l’entreprise attend de l’automatisation : l’assistant ne fait que converser. */
export const AUTOMATION_GOALS = [
  {
    value: "answer",
    label: "Répondre aux questions",
    description: "Prix, horaires, livraison, disponibilités.",
  },
  {
    value: "sell",
    label: "Vendre et prendre les commandes",
    description: "Conseiller, récapituler, faire confirmer.",
  },
  {
    value: "qualify",
    label: "Qualifier les prospects",
    description: "Besoin, budget, échéance.",
  },
  {
    value: "book",
    label: "Recueillir les rendez-vous",
    description: "Demandes de réservation à confirmer.",
  },
  {
    value: "support",
    label: "Assurer le service client",
    description: "Suivi, réclamations, après-vente.",
  },
] as const;
export type AutomationGoal = (typeof AUTOMATION_GOALS)[number]["value"];

export const BUSINESS_LIMITS = {
  nameMin: 2,
  nameMax: 100,
  descriptionMin: 20,
  descriptionMax: 1000,
  goalDetailsMax: 600,
  urlMax: 300,
  socialsMax: 6,
} as const;

export const LINKS_ENTRY_TITLE = "Site web et réseaux sociaux";

const SECTOR_IDS = new Set<string>(BUSINESS_SECTORS.map((sector) => sector.value));
const GOAL_IDS = new Set<string>(AUTOMATION_GOALS.map((goal) => goal.value));

export function isBusinessSector(value: string): value is BusinessSector {
  return SECTOR_IDS.has(value);
}
export function isAutomationGoal(value: string): value is AutomationGoal {
  return GOAL_IDS.has(value);
}
export function sectorLabel(value: string) {
  return BUSINESS_SECTORS.find((sector) => sector.value === value)?.label ?? "";
}
export function goalLabel(value: string) {
  return AUTOMATION_GOALS.find((goal) => goal.value === value)?.label ?? "";
}

/**
 * Texte saisi par le client, rendu inoffensif avant stockage ou envoi à l’IA :
 * forme Unicode unique, sans caractères de contrôle, de direction (texte
 * masqué ou inversé) ni invisibles, espaces et sauts de ligne resserrés.
 */
export function cleanText(value: string) {
  return value
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/g, "")
    .replace(/[​-‏‪-‮⁠-⁤⁦-⁩﻿]/g, "")
    .replace(/\t/g, " ")
    .replace(/[^\S\n]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/* -------------------------------------------------------------------------- */
/* Liens                                                                       */
/* -------------------------------------------------------------------------- */

const SOCIAL_NETWORKS = [
  { id: "facebook", label: "Facebook", hosts: ["facebook.com", "fb.com", "fb.me"] },
  { id: "instagram", label: "Instagram", hosts: ["instagram.com", "instagr.am"] },
  { id: "tiktok", label: "TikTok", hosts: ["tiktok.com"] },
  { id: "linkedin", label: "LinkedIn", hosts: ["linkedin.com", "lnkd.in"] },
  { id: "x", label: "X", hosts: ["x.com", "twitter.com"] },
  { id: "youtube", label: "YouTube", hosts: ["youtube.com", "youtu.be"] },
  { id: "snapchat", label: "Snapchat", hosts: ["snapchat.com"] },
  { id: "pinterest", label: "Pinterest", hosts: ["pinterest.com", "pin.it"] },
  { id: "threads", label: "Threads", hosts: ["threads.net", "threads.com"] },
  { id: "telegram", label: "Telegram", hosts: ["t.me", "telegram.me"] },
  { id: "whatsapp", label: "WhatsApp", hosts: ["wa.me", "whatsapp.com"] },
] as const;
export type SocialNetworkId = (typeof SOCIAL_NETWORKS)[number]["id"];

const DOMAIN = /^(?:[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?\.)+[a-z]{2,63}$/;

/**
 * Adresse web publique normalisée (`maboutique.com` → `https://maboutique.com`),
 * ou null : autre protocole, identifiants intégrés, adresse IP, nom local ou
 * texte qui n’est pas une adresse.
 */
export function normalizeWebLink(raw: string): string | null {
  const value = raw.trim();
  if (!value || value.length > BUSINESS_LIMITS.urlMax || /\s/.test(value)) return null;
  const withScheme = /^[a-z][a-z\d+.-]*:/i.test(value) ? value : `https://${value}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password || url.port) return null;
  if (!DOMAIN.test(url.hostname)) return null;
  url.hash = "";
  const text = url.pathname === "/" && !url.search ? url.origin : url.toString();
  return text.length <= BUSINESS_LIMITS.urlMax ? text : null;
}

/** Réseau social reconnu d’après le domaine, ou null pour un site quelconque. */
export function socialNetwork(link: string): { id: SocialNetworkId; label: string } | null {
  const url = normalizeWebLink(link);
  if (!url) return null;
  const host = new URL(url).hostname.replace(/^(?:www|m|mobile)\./, "");
  const network = SOCIAL_NETWORKS.find((item) =>
    item.hosts.some((domain) => host === domain || host.endsWith(`.${domain}`)),
  );
  return network ? { id: network.id, label: network.label } : null;
}

export type BusinessLinks = { website: string | null; socials: string[] };

/** Liens normalisés et sans doublon ; un réseau social saisi comme site reste un site. */
export function normalizeLinks(input: { website: string; socials: string[] }): BusinessLinks {
  const website = normalizeWebLink(input.website);
  const seen = new Set(website ? [website.toLowerCase()] : []);
  const socials: string[] = [];
  for (const raw of input.socials) {
    const link = normalizeWebLink(raw);
    if (!link || seen.has(link.toLowerCase())) continue;
    seen.add(link.toLowerCase());
    socials.push(link);
  }
  return { website, socials: socials.slice(0, BUSINESS_LIMITS.socialsMax) };
}

/** Contenu de l’entrée « Informations » : une ligne par lien, lisible par l’assistant. */
export function linksEntryContent(links: BusinessLinks) {
  const lines = [
    ...(links.website ? [`Site web : ${links.website}`] : []),
    ...links.socials.map((link) => `${socialNetwork(link)?.label ?? "Autre lien"} : ${link}`),
  ];
  return lines.join("\n");
}

/**
 * Liens d’une entrée, même modifiée à la main dans Connaissances : le premier
 * lien qui n’est pas un réseau social est le site web, les autres suivent.
 */
export function parseLinksContent(content: string): BusinessLinks {
  const found = (content.match(/(?:https?:\/\/|www\.)[^\s<>"'`]+/gi) ?? []).map((link) =>
    link.replace(/[.,;:!?)\]}]+$/, ""),
  );
  const links = found.map(normalizeWebLink).filter((link): link is string => !!link);
  const website = links.find((link) => !socialNetwork(link)) ?? null;
  return normalizeLinks({
    website: website ?? "",
    socials: links.filter((link) => link !== website),
  });
}

export function sameLinks(a: BusinessLinks, b: BusinessLinks) {
  return linksEntryContent(a) === linksEntryContent(b);
}

/* -------------------------------------------------------------------------- */
/* Schémas                                                                     */
/* -------------------------------------------------------------------------- */

/** Le travail de nettoyage reste borné même si un client envoie un texte énorme. */
const text = (max: number) => z.string().max(max * 4).transform(cleanText);

const linkField = z
  .string()
  .max(BUSINESS_LIMITS.urlMax, "Cette adresse est trop longue.")
  .trim()
  .refine((value) => !value || normalizeWebLink(value) !== null, {
    message: "Adresse invalide. Exemple : maboutique.com",
  });

/**
 * Fiche envoyée au serveur, revalidée par l’action. Les objectifs peuvent
 * encore être vides : la fiche s’enregistre dès le premier écran.
 */
export const BusinessProfileSchema = z.object({
  companyName: text(BUSINESS_LIMITS.nameMax).pipe(
    z
      .string()
      .min(BUSINESS_LIMITS.nameMin, "Indiquez le nom de votre entreprise.")
      .max(BUSINESS_LIMITS.nameMax, "100 caractères au maximum."),
  ),
  sector: z.string().refine(isBusinessSector, { message: "Choisissez votre secteur." }),
  description: text(BUSINESS_LIMITS.descriptionMax).pipe(
    z
      .string()
      .min(BUSINESS_LIMITS.descriptionMin, "Décrivez votre activité en une phrase au moins.")
      .max(BUSINESS_LIMITS.descriptionMax, "1 000 caractères au maximum."),
  ),
  website: linkField,
  socials: z
    .array(z.object({ url: linkField }))
    .max(BUSINESS_LIMITS.socialsMax, "6 liens au maximum."),
  goals: z
    .array(z.string().refine(isAutomationGoal, { message: "Objectif inconnu." }))
    .max(AUTOMATION_GOALS.length)
    .refine((goals) => new Set(goals).size === goals.length, { message: "Objectif en double." }),
  goalDetails: text(BUSINESS_LIMITS.goalDetailsMax).pipe(
    z.string().max(BUSINESS_LIMITS.goalDetailsMax, "600 caractères au maximum."),
  ),
});
export type BusinessProfileInput = z.input<typeof BusinessProfileSchema>;
export type BusinessProfile = z.output<typeof BusinessProfileSchema>;

/** Formulaire : au moins un objectif avant de quitter le second écran. */
export const BusinessProfileFormSchema = BusinessProfileSchema.extend({
  goals: BusinessProfileSchema.shape.goals.refine((goals) => goals.length > 0, {
    message: "Choisissez au moins un objectif.",
  }),
});

export const BUSINESS_STEP_FIELDS = {
  company: ["companyName", "sector", "description", "website", "socials"],
  goals: ["goals", "goalDetails"],
} as const satisfies Record<string, readonly (keyof BusinessProfileInput)[]>;

export const EMPTY_BUSINESS_PROFILE: BusinessProfileInput = {
  companyName: "",
  sector: "",
  description: "",
  website: "",
  socials: [],
  goals: [],
  goalDetails: "",
};

/** Contenu de `project.businessProfile`, relu avec tolérance : jamais d’erreur à l’affichage. */
const StoredSchema = z.object({
  description: z.string().max(BUSINESS_LIMITS.descriptionMax).catch(""),
  sector: z.string().max(40).catch(""),
  goals: z.array(z.string().max(40)).max(20).catch([]),
  goalDetails: z.string().max(BUSINESS_LIMITS.goalDetailsMax).catch(""),
  linksEntryId: z.string().max(40).nullable().catch(null),
});
export type StoredBusinessProfile = z.infer<typeof StoredSchema>;

export function readStoredProfile(value: unknown): StoredBusinessProfile {
  const parsed = StoredSchema.safeParse(value ?? {});
  const stored = parsed.success
    ? parsed.data
    : { description: "", sector: "", goals: [], goalDetails: "", linksEntryId: null };
  return {
    ...stored,
    sector: isBusinessSector(stored.sector) ? stored.sector : "",
    goals: [...new Set(stored.goals.filter(isAutomationGoal))],
  };
}

/** Fiche suffisante pour rédiger des instructions : activité, secteur et un objectif. */
export function profileReady(profile: Pick<StoredBusinessProfile, "description" | "sector" | "goals">) {
  return (
    profile.description.length >= BUSINESS_LIMITS.descriptionMin &&
    isBusinessSector(profile.sector) &&
    profile.goals.length > 0
  );
}
