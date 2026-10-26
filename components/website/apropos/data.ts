import {
  Image as ImageIcon,
  KeyRound,
  MessageSquareText,
  Mic,
  Search,
  ShieldOff,
  UserRoundCheck,
  type LucideIcon,
} from "lucide-react";

export type ThreadSpeaker = "client" | "ai" | "agent" | "system" | "gap";

export interface ThreadMessage {
  id: string;
  speaker: ThreadSpeaker;
  text: string;
  time?: string;
}

export const THREAD_MODES = [
  { id: "without", label: "Sans assistant" },
  { id: "with", label: "Avec ExtravertyAI" },
] as const;

export type ThreadMode = (typeof THREAD_MODES)[number]["id"];

// Illustration: the same late-evening question, handled two ways.
export const THREADS: Record<
  ThreadMode,
  { messages: readonly ThreadMessage[]; outcome: { label: string; detail: string } }
> = {
  without: {
    messages: [
      { id: "q", speaker: "client", text: "Bonsoir, la robe noire existe en taille M ?", time: "23:47" },
      { id: "gap", speaker: "gap", text: "La nuit passe, sans réponse" },
      { id: "late", speaker: "agent", text: "Bonjour ! Désolée pour l’attente, oui nous l’avons.", time: "09:12" },
      { id: "lost", speaker: "client", text: "Merci, j’ai trouvé ailleurs entre-temps.", time: "09:30" },
    ],
    outcome: { label: "Client parti", detail: "La question est arrivée quand personne ne pouvait répondre." },
  },
  with: {
    messages: [
      { id: "q", speaker: "client", text: "Bonsoir, la robe noire existe en taille M ?", time: "23:47" },
      {
        id: "ai",
        speaker: "ai",
        text: "Bonsoir ! D’après notre catalogue, elle existe en M. Souhaitez-vous qu’une conseillère vous la mette de côté ?",
        time: "23:47",
      },
      { id: "yes", speaker: "client", text: "Oui, avec plaisir !", time: "23:48" },
      { id: "handover", speaker: "system", text: "Léa reprend la conversation" },
      { id: "agent", speaker: "agent", text: "Bonjour ! C’est fait, elle vous attend en boutique.", time: "09:05" },
    ],
    outcome: {
      label: "Client servi",
      detail: "Réponse immédiate la nuit, relais humain au matin pour ce que l’IA ne peut pas faire.",
    },
  },
};

export const FORMATS: readonly { icon: LucideIcon; label: string }[] = [
  { icon: MessageSquareText, label: "Texte" },
  { icon: Mic, label: "Notes vocales" },
  { icon: ImageIcon, label: "Images" },
];

export const BUSINESSES = [
  "Boutique",
  "Restaurant",
  "Agence immobilière",
  "Salon de beauté",
  "Centre de formation",
  "Service après-vente",
] as const;

/** Rules every agent receives (lib/agent-config, buildAgentSystemMessage). */
export const COMMITMENTS: readonly { icon: LucideIcon; never: string; instead: string }[] = [
  {
    icon: Search,
    never: "Inventer un prix, un délai ou une disponibilité",
    instead: "Il s’appuie sur vos informations vérifiées et dit clairement ce qu’il ne sait pas.",
  },
  {
    icon: KeyRound,
    never: "Demander un mot de passe ou une carte bancaire",
    instead: "Aucune donnée de paiement ni aucun secret n’est réclamé à vos clients.",
  },
  {
    icon: UserRoundCheck,
    never: "Se faire passer pour un humain",
    instead: "Il se présente honnêtement comme un assistant IA dès qu’on le lui demande.",
  },
  {
    icon: ShieldOff,
    never: "Prétendre avoir agi à votre place",
    instead: "Réserver, rembourser, livrer : il oriente vers votre équipe au lieu de promettre.",
  },
];

export const PROCESS = [
  {
    title: "Comprendre",
    text: "Nous échangeons sur votre activité, vos clients et les demandes que vous souhaitez mieux gérer.",
    meta: "Un échange, sans engagement",
  },
  {
    title: "Connecter",
    text: "Vous liez votre numéro WhatsApp par QR code et retrouvez vos conversations au même endroit.",
    meta: "Moins de 5 minutes",
  },
  {
    title: "Tester et ajuster",
    text: "Vous observez les réponses de l’assistant, ajoutez vos documents et reprenez la main quand vous le souhaitez.",
    meta: "À votre rythme",
  },
] as const;
