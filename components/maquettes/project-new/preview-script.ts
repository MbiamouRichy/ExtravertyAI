import type { ToneId } from "./data";
import type { ProjectWizardValues } from "./schema";

export type PreviewInput = Pick<
  ProjectWizardValues,
  | "name"
  | "description"
  | "language"
  | "agentName"
  | "tone"
  | "useEmojis"
  | "humanHandover"
> & { sourceLabels: string[] };

export interface PreviewMessage {
  id: "hello" | "greeting" | "question" | "answer";
  from: "customer" | "business";
  text: string;
  time: string;
  /** Explains, outside the bubble, what drove this reply. Never shown to customers. */
  note?: string;
}

type Lang = "fr" | "en";

const COPY: Record<
  Lang,
  {
    business: string;
    hello: string;
    question: string;
    greeting: Record<ToneId, (business: string, agent: string) => string>;
    grounded: Record<ToneId, string>;
    handover: string;
    clarify: string;
  }
> = {
  fr: {
    business: "Votre entreprise",
    hello: "Bonjour !",
    question: "Vous livrez à domicile ?",
    greeting: {
      warm: (business, agent) =>
        `Bonjour et bienvenue chez ${business} ! Je suis ${agent}, l’assistant IA de l’équipe. Comment puis-je vous aider aujourd’hui ?`,
      professional: (business, agent) =>
        `Bonjour, vous êtes bien chez ${business}. Je suis ${agent}, assistant IA. Que puis-je faire pour vous ?`,
      direct: (business, agent) =>
        `Bonjour ! ${agent}, assistant IA de ${business}. Dites-moi ce qu’il vous faut.`,
    },
    grounded: {
      warm: "Oui, avec plaisir ! Je vous détaille nos conditions de livraison.",
      professional: "Oui. Voici nos conditions de livraison.",
      direct: "Oui. Les détails ci-dessous.",
    },
    handover:
      "Je n’ai pas encore cette information. Un conseiller de l’équipe pourra vous répondre.",
    clarify:
      "Je n’ai pas encore cette information. Pouvez-vous préciser votre demande ?",
  },
  en: {
    business: "your business",
    hello: "Hi!",
    question: "Do you deliver to my home?",
    greeting: {
      warm: (business, agent) =>
        `Hi and welcome to ${business}! I’m ${agent}, the team’s AI assistant. How can I help you today?`,
      professional: (business, agent) =>
        `Hello, you’ve reached ${business}. I’m ${agent}, an AI assistant. How may I help you?`,
      direct: (business, agent) =>
        `Hi! ${agent}, AI assistant at ${business}. What do you need?`,
    },
    grounded: {
      warm: "Yes, happily! Here are our delivery terms.",
      professional: "Yes. Here are our delivery terms.",
      direct: "Yes. Details below.",
    },
    handover:
      "I don’t have this information yet. Someone from the team can answer you.",
    clarify: "I don’t have this information yet. Could you tell me more?",
  },
};

// Notes are read by the business owner, so they stay in French.
const NOTES = {
  grounded: (source: string) => `Réponse fondée sur « ${source} »`,
  handover: "Aucune source : oriente vers un conseiller",
  clarify: "Aucune source : demande une précision",
};

function clip(value: string, max: number) {
  const clean = value.trim().replace(/\s+/g, " ");
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

/** The conversation a customer would see, derived from the wizard's answers. */
export function buildPreviewConversation(input: PreviewInput): PreviewMessage[] {
  const copy = COPY[input.language === "en" ? "en" : "fr"];
  const business = clip(input.name, 40) || copy.business;
  const agent = clip(input.agentName, 30) || "Assistant";
  // Real agent rule: one relevant emoji at most per reply.
  const emoji = input.useEmojis ? " 👋" : "";
  const source = input.sourceLabels[0];

  return [
    { id: "hello", from: "customer", text: copy.hello, time: "09:41" },
    {
      id: "greeting",
      from: "business",
      text: copy.greeting[input.tone](business, agent) + emoji,
      time: "09:41",
    },
    { id: "question", from: "customer", text: copy.question, time: "09:42" },
    source
      ? {
          id: "answer",
          from: "business",
          text: copy.grounded[input.tone],
          time: "09:42",
          note: NOTES.grounded(clip(source, 32)),
        }
      : {
          id: "answer",
          from: "business",
          text: input.humanHandover ? copy.handover : copy.clarify,
          time: "09:42",
          note: input.humanHandover ? NOTES.handover : NOTES.clarify,
        },
  ];
}

export function initialsOf(name: string) {
  const letters = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return letters || "EA";
}
