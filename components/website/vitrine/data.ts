import {
  AudioLines,
  Brain,
  Image as ImageIcon,
  MessageSquareText,
  Send,
  Sparkles,
  UserRoundCheck,
  Workflow,
  type LucideIcon,
} from "lucide-react";

import {
  PRICING_PLANS,
  formatMessageLimit,
  type PlanId,
  type PricingPlan,
} from "@/lib/pricing";

/* -------------------------------------------------------------------------- */
/* Navigation                                                                  */
/* -------------------------------------------------------------------------- */

export const SECTIONS = [
  { id: "demo", label: "Démo" },
  { id: "parcours", label: "Parcours" },
  { id: "fonctionnalites", label: "Fonctionnalités" },
  { id: "analytique", label: "Analytique" },
  { id: "tarifs", label: "Tarifs" },
] as const;

export type SectionId = (typeof SECTIONS)[number]["id"];

/* -------------------------------------------------------------------------- */
/* Hero conversation simulator                                                 */
/* -------------------------------------------------------------------------- */

export type Speaker = "client" | "ai" | "agent" | "system";

export interface SimMessage {
  id: string;
  speaker: Speaker;
  text: string;
  time: string;
  /** Voice notes render as a waveform with their duration. */
  voice?: { duration: string };
}

export interface TraceStep {
  id: string;
  at: string;
  label: string;
  detail: string;
}

/** Each beat waits `delay` ms after the previous one before it is revealed. */
export type Beat =
  | { kind: "message"; delay: number; message: SimMessage }
  | { kind: "typing"; delay: number; who: "ai" | "agent" }
  | { kind: "trace"; delay: number; step: TraceStep };

export type ScenarioId = "commande" | "rendez-vous" | "reclamation";

export interface Scenario {
  id: ScenarioId;
  label: string;
  contact: { name: string; initials: string; business: string };
  agentName?: string;
  outcome: { label: string; detail: string };
  beats: readonly Beat[];
}

export const SCENARIOS: readonly Scenario[] = [
  {
    id: "commande",
    label: "Commande",
    contact: { name: "Kevin M.", initials: "KM", business: "Urban Shoes · Yaoundé" },
    outcome: { label: "Prospect qualifié", detail: "Étiqueté « Intéressant » par Instinct IA" },
    beats: [
      {
        kind: "message",
        delay: 0,
        message: {
          id: "c1",
          speaker: "client",
          text: "Bonsoir ! Vous avez encore les sneakers blanches en 42 ?",
          time: "21:47",
        },
      },
      { kind: "trace", delay: 700, step: { id: "t1", at: "0,4 s", label: "Intention", detail: "Disponibilité produit · confiance 0,96" } },
      { kind: "trace", delay: 650, step: { id: "t2", at: "1,1 s", label: "Catalogue", detail: "Sneakers Urban blanc · 42 → 3 paires" } },
      { kind: "typing", delay: 500, who: "ai" },
      { kind: "trace", delay: 700, step: { id: "t3", at: "2,3 s", label: "Rédaction", detail: "Ton chaleureux · vouvoiement" } },
      {
        kind: "message",
        delay: 1100,
        message: {
          id: "a1",
          speaker: "ai",
          text: "Bonsoir Kevin 👋 Oui, il nous reste 3 paires en 42. Je vous en mets une de côté ? Livraison possible à Yaoundé dès demain.",
          time: "21:47",
        },
      },
      { kind: "trace", delay: 350, step: { id: "t4", at: "3,4 s", label: "Envoyé", detail: "Réponse livrée sur votre numéro" } },
      {
        kind: "message",
        delay: 1700,
        message: { id: "c2", speaker: "client", text: "Oui, mettez-m’en une de côté svp 🙏", time: "21:48" },
      },
      { kind: "typing", delay: 600, who: "ai" },
      {
        kind: "message",
        delay: 1300,
        message: {
          id: "a2",
          speaker: "ai",
          text: "C’est noté ✅ Un conseiller vous confirme le paiement et la livraison ici même dans la soirée.",
          time: "21:48",
        },
      },
      { kind: "trace", delay: 450, step: { id: "t5", at: "+ 1 min", label: "Instinct IA", detail: "Intention d’achat détectée → Intéressant" } },
    ],
  },
  {
    id: "rendez-vous",
    label: "Rendez-vous",
    contact: { name: "Aminata D.", initials: "AD", business: "Salon Nappy Queen · Dakar" },
    outcome: { label: "À relancer", detail: "Étiqueté « À suivre » en attente de confirmation" },
    beats: [
      {
        kind: "message",
        delay: 0,
        message: {
          id: "c1",
          speaker: "client",
          text: "Note vocale",
          time: "10:12",
          voice: { duration: "0:12" },
        },
      },
      {
        kind: "trace",
        delay: 800,
        step: {
          id: "t1",
          at: "0,9 s",
          label: "Transcription",
          detail: "« Je voudrais un rendez-vous samedi matin pour une coupe »",
        },
      },
      { kind: "trace", delay: 650, step: { id: "t2", at: "1,4 s", label: "Intention", detail: "Demande de rendez-vous · confiance 0,94" } },
      { kind: "trace", delay: 600, step: { id: "t3", at: "1,9 s", label: "Instructions", detail: "Ouvert le samedi de 9 h à 13 h" } },
      { kind: "typing", delay: 450, who: "ai" },
      {
        kind: "message",
        delay: 1200,
        message: {
          id: "a1",
          speaker: "ai",
          text: "Bonjour Aminata ! Avec plaisir. Le samedi, le salon est ouvert de 9 h à 13 h : vous préférez 9 h 30 ou 11 h ?",
          time: "10:12",
        },
      },
      { kind: "trace", delay: 350, step: { id: "t4", at: "3,8 s", label: "Envoyé", detail: "Réponse livrée sur votre numéro" } },
      {
        kind: "message",
        delay: 1700,
        message: { id: "c2", speaker: "client", text: "11 h c’est parfait 😊", time: "10:13" },
      },
      { kind: "typing", delay: 600, who: "ai" },
      {
        kind: "message",
        delay: 1200,
        message: {
          id: "a2",
          speaker: "ai",
          text: "Parfait ! Je transmets votre demande pour samedi 11 h, l’équipe vous confirme le créneau ici même.",
          time: "10:13",
        },
      },
      { kind: "trace", delay: 450, step: { id: "t5", at: "+ 1 min", label: "Instinct IA", detail: "Confirmation attendue → À suivre" } },
    ],
  },
  {
    id: "reclamation",
    label: "Réclamation",
    contact: { name: "Grace T.", initials: "GT", business: "Maison Akwa · Douala" },
    agentName: "Clara",
    outcome: { label: "Transfert humain", detail: "Clara a repris la main avec le résumé IA" },
    beats: [
      {
        kind: "message",
        delay: 0,
        message: {
          id: "c1",
          speaker: "client",
          text: "Ma commande #4821 est arrivée abîmée. Je veux être remboursée.",
          time: "14:03",
        },
      },
      { kind: "trace", delay: 700, step: { id: "t1", at: "0,5 s", label: "Intention", detail: "Réclamation · remboursement · 0,93" } },
      { kind: "trace", delay: 650, step: { id: "t2", at: "1,0 s", label: "Règle de transfert", detail: "Remboursements → équipe humaine" } },
      { kind: "typing", delay: 450, who: "ai" },
      {
        kind: "message",
        delay: 1200,
        message: {
          id: "a1",
          speaker: "ai",
          text: "Je suis vraiment désolé, Grace. Je transmets votre dossier à notre équipe : une conseillère vous répond ici dans quelques minutes.",
          time: "14:03",
        },
      },
      { kind: "trace", delay: 400, step: { id: "t3", at: "3,1 s", label: "Résumé IA", detail: "Colis #4821 abîmé · demande de remboursement" } },
      { kind: "trace", delay: 600, step: { id: "t4", at: "3,2 s", label: "Transfert", detail: "Clara alertée · résumé joint" } },
      {
        kind: "message",
        delay: 1100,
        message: { id: "s1", speaker: "system", text: "Clara a repris la conversation · IA en pause", time: "14:05" },
      },
      { kind: "typing", delay: 500, who: "agent" },
      {
        kind: "message",
        delay: 1400,
        message: {
          id: "h1",
          speaker: "agent",
          text: "Bonjour Grace, c’est Clara. Je m’occupe de vous : pouvez-vous m’envoyer une photo du colis ?",
          time: "14:05",
        },
      },
    ],
  },
];

/* -------------------------------------------------------------------------- */
/* Product facts (same claims as the live site, nothing invented)              */
/* -------------------------------------------------------------------------- */

export interface Fact {
  value: number;
  prefix?: string;
  suffix: string;
  label: string;
}

export const FACTS: readonly Fact[] = [
  { value: 24, suffix: "/7", label: "Réponses, même la nuit et le week-end" },
  { value: 5, prefix: "< ", suffix: " min", label: "Pour connecter votre numéro WhatsApp" },
  { value: 3, suffix: " formats", label: "Texte, notes vocales et images compris" },
  { value: 1, suffix: " clic", label: "Pour reprendre la main sur l’IA" },
];

/* -------------------------------------------------------------------------- */
/* Message pipeline                                                            */
/* -------------------------------------------------------------------------- */

export type PipelineNodeId =
  | "texte"
  | "vocal"
  | "image"
  | "comprehension"
  | "agent"
  | "reponse"
  | "instinct"
  | "transfert";

export interface PipelineNode {
  id: PipelineNodeId;
  stage: 0 | 1 | 2 | 3;
  title: string;
  caption: string;
  icon: LucideIcon;
  description: string;
  config: readonly { key: string; value: string }[];
}

export const PIPELINE_STAGES = ["Entrée", "Analyse", "Décision", "Issue"] as const;

export const PIPELINE_NODES: readonly PipelineNode[] = [
  {
    id: "texte",
    stage: 0,
    title: "Texte",
    caption: "Message écrit",
    icon: MessageSquareText,
    description:
      "Vos clients écrivent comme ils parlent : abréviations, fautes, emojis. L’assistant lit tout, sur votre numéro habituel.",
    config: [
      { key: "canal", value: "WhatsApp" },
      { key: "numéro", value: "le vôtre, inchangé" },
      { key: "offres", value: "toutes" },
    ],
  },
  {
    id: "vocal",
    stage: 0,
    title: "Note vocale",
    caption: "Audio",
    icon: AudioLines,
    description:
      "Les notes vocales sont retranscrites automatiquement, puis traitées comme n’importe quel message.",
    config: [
      { key: "format", value: "audio WhatsApp" },
      { key: "transcription", value: "automatique" },
      { key: "offres", value: "Pro, Business" },
    ],
  },
  {
    id: "image",
    stage: 0,
    title: "Photo",
    caption: "Image",
    icon: ImageIcon,
    description:
      "Photo produit, capture d’écran, colis abîmé : l’image est analysée pour que la réponse tienne compte de ce qu’elle montre.",
    config: [
      { key: "format", value: "image" },
      { key: "analyse", value: "contenu de l’image" },
      { key: "offres", value: "Business" },
    ],
  },
  {
    id: "comprehension",
    stage: 1,
    title: "Compréhension",
    caption: "Intention et contexte",
    icon: Brain,
    description:
      "L’IA relit l’historique de la conversation pour comprendre ce que veut vraiment le client, dans sa langue.",
    config: [
      { key: "historique", value: "conversation complète" },
      { key: "langue", value: "détectée" },
      { key: "intention", value: "classée" },
    ],
  },
  {
    id: "agent",
    stage: 2,
    title: "Votre agent IA",
    caption: "Vos règles, votre ton",
    icon: Workflow,
    description:
      "Il s’appuie sur les instructions que vous lui donnez : votre activité, vos prix, vos horaires, votre façon de parler.",
    config: [
      { key: "instructions", value: "rédigées par vous" },
      { key: "ton", value: "personnalisé" },
      { key: "pause", value: "par conversation ou globale" },
    ],
  },
  {
    id: "reponse",
    stage: 3,
    title: "Réponse",
    caption: "Envoyée par l’IA",
    icon: Send,
    description:
      "Le client reçoit une réponse en quelques secondes, de jour comme de nuit, directement dans WhatsApp.",
    config: [
      { key: "délai", value: "quelques secondes" },
      { key: "disponibilité", value: "24 h/24, 7 j/7" },
      { key: "suivi", value: "dans la messagerie" },
    ],
  },
  {
    id: "instinct",
    stage: 3,
    title: "Instinct IA",
    caption: "Prospect repéré",
    icon: Sparkles,
    description:
      "Après chaque message, Instinct IA repère les prospects intéressants et ceux à relancer, selon les objectifs de votre agent.",
    config: [
      { key: "étiquettes", value: "Intéressant · À suivre" },
      { key: "déclenchement", value: "après chaque message" },
      { key: "offres", value: "Pro, Business" },
    ],
  },
  {
    id: "transfert",
    stage: 3,
    title: "Transfert",
    caption: "Vers votre équipe",
    icon: UserRoundCheck,
    description:
      "Quand un humain fait la différence, l’IA se met en retrait et vous alerte. Un résumé vous évite de tout relire.",
    config: [
      { key: "reprise", value: "en un clic" },
      { key: "contexte", value: "résumé IA joint" },
      { key: "alerte", value: "notification à l’équipe" },
    ],
  },
];

export const PIPELINE_EDGES: readonly (readonly [PipelineNodeId, PipelineNodeId])[] = [
  ["texte", "comprehension"],
  ["vocal", "comprehension"],
  ["image", "comprehension"],
  ["comprehension", "agent"],
  ["agent", "reponse"],
  ["agent", "instinct"],
  ["agent", "transfert"],
];

export interface PipelineRoute {
  id: string;
  short: string;
  label: string;
  nodes: readonly PipelineNodeId[];
}

export const PIPELINE_ROUTES: readonly PipelineRoute[] = [
  {
    id: "simple",
    short: "Question simple",
    label: "Un client demande un prix → réponse immédiate",
    nodes: ["texte", "comprehension", "agent", "reponse"],
  },
  {
    id: "prospect",
    short: "Prospect",
    label: "Une note vocale d’achat → prospect repéré",
    nodes: ["vocal", "comprehension", "agent", "instinct"],
  },
  {
    id: "sensible",
    short: "Cas sensible",
    label: "La photo d’un colis abîmé → équipe alertée",
    nodes: ["image", "comprehension", "agent", "transfert"],
  },
];

/* -------------------------------------------------------------------------- */
/* Analytics preview (demonstration data)                                      */
/* -------------------------------------------------------------------------- */

export type RangeId = "jour" | "semaine" | "mois";

export interface AnalyticsRange {
  id: RangeId;
  label: string;
  /** Short label used for the sr-only data table and tooltips. */
  unit: string;
  points: readonly { label: string; value: number }[];
  /** Index labels shown under the axis; others stay in the tooltip/table. */
  tickEvery: number;
  kpis: {
    conversations: number;
    medianSeconds: number;
    aiShare: number;
    handovers: number;
    delta: number;
  };
}

const hourly = [4, 2, 1, 1, 1, 2, 6, 14, 26, 38, 44, 52, 61, 48, 41, 39, 47, 58, 72, 84, 79, 63, 37, 15];
const daily = [212, 248, 231, 266, 301, 344, 197];
const dayNames = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."];
const monthly = [
  162, 188, 174, 205, 231, 266, 141, 170, 196, 183, 214, 247, 289, 152, 181, 203, 190, 226, 262, 301, 166,
  194, 219, 207, 241, 276, 318, 181, 212, 248,
];

export const ANALYTICS_RANGES: readonly AnalyticsRange[] = [
  {
    id: "jour",
    label: "Aujourd’hui",
    unit: "heure",
    tickEvery: 6,
    points: hourly.map((value, hour) => ({ label: `${hour} h`, value })),
    kpis: { conversations: 874, medianSeconds: 3.8, aiShare: 86, handovers: 41, delta: 12 },
  },
  {
    id: "semaine",
    label: "7 jours",
    unit: "jour",
    tickEvery: 1,
    points: daily.map((value, index) => ({ label: dayNames[index], value })),
    kpis: { conversations: 1799, medianSeconds: 4.1, aiShare: 84, handovers: 96, delta: 8 },
  },
  {
    id: "mois",
    label: "30 jours",
    unit: "jour",
    tickEvery: 5,
    points: monthly.map((value, index) => ({ label: `J${index + 1}`, value })),
    kpis: { conversations: 6532, medianSeconds: 4.3, aiShare: 83, handovers: 352, delta: 21 },
  },
];

export interface FeedEvent {
  contact: string;
  action: string;
  actor: "IA" | "Équipe";
}

export const FEED_POOL: readonly FeedEvent[] = [
  { contact: "Kevin M.", action: "Réponse envoyée en 3,4 s", actor: "IA" },
  { contact: "Grace T.", action: "Transférée à Clara avec résumé", actor: "IA" },
  { contact: "Aminata D.", action: "Étiquetée « À suivre »", actor: "IA" },
  { contact: "Boutique Elo", action: "Note vocale retranscrite", actor: "IA" },
  { contact: "Moussa K.", action: "Prospect « Intéressant » repéré", actor: "IA" },
  { contact: "Grace T.", action: "Conversation résolue par Clara", actor: "Équipe" },
  { contact: "Inès B.", action: "Réponse envoyée en 2,9 s", actor: "IA" },
  { contact: "Paul E.", action: "Photo produit analysée", actor: "IA" },
];

/* -------------------------------------------------------------------------- */
/* Feature matrix (mirrors lib/pricing.ts features)                            */
/* -------------------------------------------------------------------------- */

export type MatrixCell = boolean | string;

export interface MatrixRow {
  label: string;
  values: Record<PlanId, MatrixCell>;
}

export interface MatrixGroup {
  title: string;
  rows: readonly MatrixRow[];
}

const all = { starter: true, pro: true, business: true } as const;

/** Reads a value from every plan so capacity rows stay in sync with lib/pricing. */
function byPlan(pick: (plan: PricingPlan) => MatrixCell): Record<PlanId, MatrixCell> {
  const [starter, pro, business] = PRICING_PLANS;
  return { starter: pick(starter), pro: pick(pro), business: pick(business) };
}

export const MATRIX_GROUPS: readonly MatrixGroup[] = [
  {
    title: "Capacité",
    rows: [
      { label: "Utilisateurs", values: byPlan((plan) => String(plan.users)) },
      { label: "Numéro WhatsApp", values: byPlan(() => "1") },
      { label: "Messages par mois", values: byPlan((plan) => formatMessageLimit(plan.messageLimit)) },
    ],
  },
  {
    title: "Assistant IA",
    rows: [
      { label: "Assistant WhatsApp 24 h/24, 7 j/7", values: all },
      { label: "Réponses textuelles", values: all },
      { label: "Compréhension des notes vocales", values: { starter: false, pro: true, business: true } },
      { label: "Compréhension des images", values: { starter: false, pro: false, business: true } },
      { label: "Suggestions et reformulation IA", values: all },
    ],
  },
  {
    title: "Pilotage commercial",
    rows: [
      { label: "Instinct IA : prospects repérés", values: { starter: false, pro: true, business: true } },
      { label: "Résumé IA des conversations", values: { starter: false, pro: true, business: true } },
      { label: "Export CSV des contacts", values: { starter: false, pro: true, business: true } },
      { label: "Rapports hebdomadaires programmés", values: { starter: false, pro: false, business: true } },
      { label: "Historique des statistiques", values: { starter: "30 jours", pro: "90 jours", business: "12 mois" } },
    ],
  },
  {
    title: "Équipe et support",
    rows: [
      { label: "Messagerie partagée", values: all },
      { label: "Notes internes et étiquettes", values: all },
      { label: "Reprise en main en un clic", values: all },
      {
        label: "Accompagnement",
        values: { starter: "Standard", pro: "Prioritaire", business: "Configuration incluse" },
      },
    ],
  },
];
