export type Author = "contact" | "ai" | "agent" | "note" | "system";
export type Delivery = "sending" | "sent" | "delivered" | "read";
export type ConversationStatus = "pending" | "ai" | "human" | "resolved";

export type Message = {
  id: string;
  author: Author;
  day: string;
  time: string;
  text: string;
  kind?: "text" | "voice" | "image";
  duration?: string;
  delivery?: Delivery;
};

import type { ProspectClassification } from "@/lib/instinct-classification";

export type Agent = { id: string; name: string };

export type Conversation = {
  id: string;
  name: string;
  phone: string;
  status: ConversationStatus;
  aiActive: boolean;
  /** Instinct IA : null tant que la dernière analyse n’est pas disponible. */
  instinct: ProspectClassification | null;
  agents: Agent[];
  unread: number;
  lastActivity: string;
  tags: string[];
  source: string;
  firstContact: string;
  summary: string[];
  suggestions: string[];
  messages: Message[];
};

export const instinctLabel: Record<ProspectClassification, string> = {
  interesting: "Prospect intéressant",
  follow_up: "À suivre",
  none: "Sans intérêt détecté",
};

const paul: Agent = { id: "u1", name: "Paul Mbia" };
const ines: Agent = { id: "u2", name: "Inès Fotso" };

export const statusLabel: Record<ConversationStatus, string> = {
  pending: "À traiter",
  ai: "Gérée par l’IA",
  human: "Prise en main",
  resolved: "Résolue",
};

export const conversations: Conversation[] = [
  {
    id: "c1",
    name: "Aïcha Ndiaye",
    phone: "+237 6•• •• •• 41",
    status: "pending",
    aiActive: false,
    instinct: "interesting",
    agents: [paul],
    unread: 2,
    lastActivity: "09:42",
    tags: ["Commande", "Douala"],
    source: "Lien WhatsApp · Instagram",
    firstContact: "12 oct.",
    summary: [
      "Souhaite la robe en lin coloris sauge, taille M.",
      "Demande une livraison express à Douala demain.",
      "A demandé à parler à un conseiller pour un paiement en deux fois.",
    ],
    suggestions: [
      "Bonjour Aïcha, je prends le relais 🙂 Le paiement en 2 fois est possible.",
      "Je vous envoie le lien de paiement en deux échéances ?",
    ],
    messages: [
      { id: "m1", author: "contact", day: "Hier", time: "18:03", text: "Bonsoir, la robe en lin existe en taille M ?" },
      { id: "m2", author: "ai", day: "Hier", time: "18:03", text: "Bonsoir Aïcha 👋 Oui, il reste 3 pièces en taille M : beige et sauge. Laquelle vous ferait plaisir ?", delivery: "read" },
      { id: "m3", author: "contact", day: "Hier", time: "18:05", kind: "image", text: "Photo du coloris sauge" },
      { id: "m4", author: "ai", day: "Hier", time: "18:05", text: "C’est bien le coloris sauge sur votre photo. Il est disponible en M. Je vous la réserve ?", delivery: "read" },
      { id: "m5", author: "contact", day: "Aujourd’hui", time: "09:38", kind: "voice", duration: "0:14", text: "Oui je la prends. Est-ce que je peux payer en deux fois ? Et livrer demain à Douala ?" },
      { id: "m6", author: "ai", day: "Aujourd’hui", time: "09:39", text: "Livraison express possible demain avant 18 h à Douala. Pour le paiement en deux fois, je transmets à un conseiller qui vous répond tout de suite.", delivery: "read" },
      { id: "m7", author: "system", day: "Aujourd’hui", time: "09:39", text: "L’IA a transmis la conversation · paiement fractionné demandé" },
      { id: "m8", author: "contact", day: "Aujourd’hui", time: "09:41", text: "Merci !" },
      { id: "m9", author: "contact", day: "Aujourd’hui", time: "09:42", text: "J’attends votre retour 🙏" },
    ],
  },
  {
    id: "c2",
    name: "Marc Tchoua",
    phone: "+237 6•• •• •• 07",
    status: "ai",
    aiActive: true,
    instinct: "follow_up",
    agents: [],
    unread: 0,
    lastActivity: "09:15",
    tags: ["Renseignement"],
    source: "Recherche Google",
    firstContact: "Aujourd’hui",
    summary: [
      "Compare les délais de livraison pour Yaoundé.",
      "N’a pas encore choisi de produit.",
    ],
    suggestions: ["Souhaitez-vous que je vous envoie le catalogue complet ?"],
    messages: [
      { id: "m1", author: "contact", day: "Aujourd’hui", time: "09:12", text: "Vous livrez à Yaoundé ?" },
      { id: "m2", author: "ai", day: "Aujourd’hui", time: "09:12", text: "Oui, en 48 h ouvrées. La livraison est offerte dès 30 000 FCFA d’achat.", delivery: "read" },
      { id: "m3", author: "contact", day: "Aujourd’hui", time: "09:15", text: "Ok merci, je regarde le catalogue" },
      { id: "m4", author: "ai", day: "Aujourd’hui", time: "09:15", text: "Avec plaisir ! Je reste disponible si une pièce vous intéresse.", delivery: "delivered" },
    ],
  },
  {
    id: "c3",
    name: "Sarah Kamga",
    phone: "+237 6•• •• •• 92",
    status: "ai",
    aiActive: true,
    instinct: "interesting",
    agents: [ines],
    unread: 1,
    lastActivity: "08:57",
    tags: ["Commande", "Récurrente"],
    source: "Client existant",
    firstContact: "3 sept.",
    summary: [
      "Cliente fidèle (4e commande).",
      "Recommande le même ensemble en taille L.",
    ],
    suggestions: ["Je prépare la même commande que la dernière fois ?"],
    messages: [
      { id: "m1", author: "contact", day: "Aujourd’hui", time: "08:55", kind: "voice", duration: "0:21", text: "Bonjour, je voudrais recommander le même ensemble que le mois dernier mais en L cette fois." },
      { id: "m2", author: "ai", day: "Aujourd’hui", time: "08:56", text: "Bonjour Sarah ! L’ensemble wax bleu est disponible en L. Même adresse de livraison à Bastos ?", delivery: "read" },
      { id: "m3", author: "contact", day: "Aujourd’hui", time: "08:57", text: "Oui exactement" },
    ],
  },
  {
    id: "c4",
    name: "Boutique Elo",
    phone: "+237 6•• •• •• 18",
    status: "human",
    aiActive: false,
    instinct: "follow_up",
    agents: [paul, ines],
    unread: 0,
    lastActivity: "Hier",
    tags: ["B2B", "Grossiste"],
    source: "Recommandation",
    firstContact: "Hier",
    summary: ["Revendeur intéressé par des achats en volume.", "Attend une grille tarifaire."],
    suggestions: ["Voici notre grille tarifaire revendeur en pièce jointe."],
    messages: [
      { id: "m1", author: "contact", day: "Hier", time: "16:20", text: "Bonjour, vous faites des prix pour les revendeurs ?" },
      { id: "m2", author: "agent", day: "Hier", time: "16:31", text: "Bonjour ! Oui, à partir de 20 pièces. Je vous prépare une grille d’ici demain.", delivery: "read" },
      { id: "m3", author: "note", day: "Hier", time: "16:32", text: "Penser à valider la remise de 15 % avec Paul avant d’envoyer." },
    ],
  },
  {
    id: "c5",
    name: "Jean-Paul Mbarga",
    phone: "+237 6•• •• •• 33",
    status: "resolved",
    aiActive: true,
    instinct: "none",
    agents: [ines],
    unread: 0,
    lastActivity: "Lun.",
    tags: ["SAV"],
    source: "Client existant",
    firstContact: "28 sept.",
    summary: ["Question sur un retour produit, résolue par l’IA."],
    suggestions: [],
    messages: [
      { id: "m1", author: "contact", day: "Lundi", time: "11:02", text: "Comment je retourne un article ?" },
      { id: "m2", author: "ai", day: "Lundi", time: "11:02", text: "Vous avez 14 jours pour un retour. Déposez l’article en boutique avec votre reçu, le remboursement est fait sous 48 h.", delivery: "read" },
      { id: "m3", author: "contact", day: "Lundi", time: "11:04", text: "Parfait merci" },
      { id: "m4", author: "system", day: "Lundi", time: "11:05", text: "Conversation marquée comme résolue" },
    ],
  },
  {
    id: "c6",
    name: "Fatou Bello",
    phone: "+237 6•• •• •• 59",
    status: "ai",
    aiActive: true,
    instinct: null,
    agents: [],
    unread: 0,
    lastActivity: "Dim.",
    tags: [],
    source: "Lien WhatsApp · Facebook",
    firstContact: "Dim.",
    summary: ["Demande des horaires d’ouverture."],
    suggestions: [],
    messages: [
      { id: "m1", author: "contact", day: "Dimanche", time: "14:40", text: "Vous êtes ouverts aujourd’hui ?" },
      { id: "m2", author: "ai", day: "Dimanche", time: "14:40", text: "La boutique est fermée le dimanche. Nous rouvrons demain de 9 h à 19 h. Je peux vous aider en attendant ?", delivery: "read" },
    ],
  },
];
