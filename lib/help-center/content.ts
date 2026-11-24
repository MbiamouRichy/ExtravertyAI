/**
 * Centre d’aide : source unique du contenu.
 *
 * Les pages /aide, l’export Markdown (/aide.md, docs/centre-aide.md) et les
 * textes à copier dans WhatsApp sont tous produits à partir de ces données.
 *
 * Mise en forme dans les textes (voir lib/help-center/inline.ts) :
 * - `**texte**` : gras ;
 * - `[[Libellé]]` : libellé d’un bouton ou d’un écran de l’application ;
 * - `[texte](/aide/slug)` ou `[texte](https://…)` : lien.
 */

import { PRICING_PLANS, TRIAL_DAYS, TRIAL_MESSAGES, formatPlanPrice } from "../pricing";

export const HELP_UPDATED_AT = "2026-11-22";
export const SUPPORT_WHATSAPP_DISPLAY = "+241 76 20 56 29";
export const HELP_DESCRIPTION =
  "Guides pas à pas pour mettre en ligne votre assistant WhatsApp ExtravertyAI : compte, numéro, configuration, connaissances, équipe et facturation.";

/** Les chiffres des forfaits viennent de lib/pricing.ts : l’aide ne peut pas les contredire. */
const TRIAL = `${TRIAL_DAYS} jours et jusqu’à ${TRIAL_MESSAGES} messages`;
const formatCount = (value: number) => new Intl.NumberFormat("fr-FR").format(value);
const perPlan = (pick: (plan: (typeof PRICING_PLANS)[number]) => string) => PRICING_PLANS.map(pick);
const PLAN_PRICES = perPlan((plan) => `${plan.name} ${formatPlanPrice(plan.priceCents)}`).join(", ");

export type HelpFigureId =
  | "parcours"
  | "inscription"
  | "projet"
  | "verification"
  | "entreprise"
  | "profil"
  | "test"
  | "connexion"
  | "circuit";

export type HelpBlock =
  | { type: "p"; text: string }
  | { type: "steps"; items: string[] }
  | { type: "bullets"; items: string[] }
  | { type: "checklist"; items: string[] }
  | {
      type: "callout";
      tone: "tip" | "warning" | "note" | "success";
      title: string;
      text: string;
    }
  | { type: "example"; title: string; text: string }
  | {
      type: "figure";
      figure: HelpFigureId;
      caption: string;
      /** Ce que montre l’illustration, pour les lecteurs d’écran et l’export Markdown. */
      description: string;
    }
  | { type: "table"; caption: string; head: string[]; rows: string[][]; note?: string }
  | { type: "faq"; items: { question: string; answer: string }[] }
  | { type: "next"; items: { slug: string; title: string; text: string }[] };

export type HelpSection = {
  id: string;
  title: string;
  level?: 2 | 3;
  /** Étape numérotée du guide : durée indicative et texte prêt pour WhatsApp. */
  step?: { number: number; duration: string; whatsapp: string[] };
  blocks: HelpBlock[];
};

export type HelpArticle = {
  slug: string;
  title: string;
  groupId: HelpGroupId;
  summary: string;
  keywords: string[];
  /** Offre requise, quand la fonctionnalité n’est pas dans toutes les offres. */
  plan?: string;
  audience?: string;
  /** Guide complet ; sinon fiche courte, annoncée comme telle. */
  detailed?: boolean;
  sections: HelpSection[];
};

export type HelpGroupId =
  | "prise-en-main"
  | "assistant"
  | "conversations"
  | "ventes"
  | "pilotage"
  | "equipe"
  | "facturation"
  | "aide";

export type HelpGroup = {
  id: HelpGroupId;
  label: string;
  description: string;
};

export const HELP_GROUPS: HelpGroup[] = [
  { id: "prise-en-main", label: "Prise en main", description: "Compte, forfait et mise en ligne de votre assistant." },
  { id: "assistant", label: "Assistant IA", description: "Son entreprise, sa personnalité, ses connaissances et ses tests." },
  { id: "conversations", label: "Conversations", description: "La messagerie partagée et la reprise en main." },
  { id: "ventes", label: "Ventes et prospects", description: "Qualification, pipeline, relances et diffusions." },
  { id: "pilotage", label: "Pilotage", description: "Statistiques, rapports et exports." },
  { id: "equipe", label: "Équipe et intégrations", description: "Membres, rôles, webhooks et Google Sheets." },
  { id: "facturation", label: "Compte et facturation", description: "Abonnement, recharges et paramètres." },
  { id: "aide", label: "Aide", description: "Questions fréquentes et contact." },
];

/** Fiche courte : l’essentiel en points, sans guide pas à pas. */
function brief(
  article: Omit<HelpArticle, "sections"> & {
    points: string[];
    extra?: HelpSection[];
  },
): HelpArticle {
  const { points, extra = [], ...rest } = article;
  return {
    ...rest,
    sections: [
      { id: "essentiel", title: "L’essentiel", blocks: [{ type: "checklist", items: points }] },
      ...extra,
    ],
  };
}

const GUIDE: HelpArticle = {
  slug: "demarrer",
  title: "Mettre votre assistant WhatsApp en ligne",
  groupId: "prise-en-main",
  summary:
    "Du compte à la première réponse automatique : cinq étapes, une quinzaine de minutes. À la fin, votre assistant répond à vos clients sur WhatsApp jour et nuit, et votre équipe peut reprendre la main à tout moment.",
  keywords: ["commencer", "démarrer", "installation", "configuration", "qr code", "connexion", "essai gratuit", "vérifier numéro", "premier pas"],
  audience: "Pour les propriétaires et administrateurs",
  detailed: true,
  sections: [
    {
      id: "avant",
      title: "Avant de commencer",
      blocks: [
        { type: "p", text: "Préparez ces éléments. Vous irez plus vite et votre assistant sera juste dès sa première réponse." },
        {
          type: "checklist",
          items: [
            "Le **téléphone** qui porte votre numéro WhatsApp professionnel, avec WhatsApp ou WhatsApp Business installé.",
            "Une **adresse e-mail** que vous consultez, ou un compte Google.",
            "Une phrase qui décrit votre **activité**, et si vous en avez, votre logo, votre site web et vos réseaux sociaux.",
            "Les **informations** que vos clients demandent le plus : horaires, prix, zones de livraison, moyens de paiement.",
          ],
        },
      ],
    },
    {
      id: "parcours",
      title: "Le parcours en un coup d’œil",
      blocks: [
        { type: "p", text: "Votre assistant ne répond à personne tant que les étapes 4 et 5 ne sont pas terminées. Vous gardez la main jusqu’au bout." },
        {
          type: "figure",
          figure: "parcours",
          caption: "Durées indicatives, pour un premier projet.",
          description: "Cinq étapes : compte avec un code reçu par e-mail ou Google (1 min), projet (2 min), numéro vérifié et essai (1 min), assistant en six écrans (8 min), WhatsApp connecté (1 min).",
        },
      ],
    },
    {
      id: "etape-1",
      title: "Créer votre compte",
      step: {
        number: 1,
        duration: "1 min",
        whatsapp: [
          "Ouvrez https://www.extravertyai.com/sign-up",
          "Indiquez votre nom et votre adresse e-mail, puis touchez [[Continuer]]. Ou touchez [[Continuer avec Google]].",
          "Saisissez le code à 6 chiffres reçu par e-mail, puis touchez [[Créer mon compte]].",
          "Aucun mot de passe n’est demandé.",
        ],
      },
      blocks: [
        { type: "p", text: "L’inscription ne demande que votre nom et votre adresse e-mail. Un code envoyé par e-mail confirme l’adresse, crée le compte et vous connecte : aucun mot de passe n’est demandé." },
        {
          type: "steps",
          items: [
            "Ouvrez [extravertyai.com/sign-up](https://www.extravertyai.com/sign-up).",
            "Indiquez votre **nom** et votre **adresse e-mail**, puis touchez [[Continuer]].",
            "Saisissez le **code à 6 chiffres** reçu par e-mail, puis touchez [[Créer mon compte]]. Vous êtes connecté et la page [[Mes projets]] s’ouvre.",
          ],
        },
        { type: "p", text: "Vous préférez Google ? Touchez [[Continuer avec Google]] à la place : il n’y a rien d’autre à saisir." },
        {
          type: "figure",
          figure: "inscription",
          caption: "Interface simplifiée : le formulaire d’inscription, puis l’écran du code.",
          description: "Écran « Créer votre compte » avec les champs Nom et E-mail, le bouton Continuer et le bouton Continuer avec Google ; puis l’écran « Vérifiez votre e-mail » avec le champ Code de vérification, le bouton Ajouter un mot de passe (facultatif) et le bouton Créer mon compte.",
        },
        {
          type: "callout",
          tone: "tip",
          title: "Astuce",
          text: "Rien reçu ? Regardez dans vos courriers indésirables, puis touchez [[Renvoyer le code]]. Un code expire au bout de 10 minutes, et un nouveau code remplace l’ancien. Adresse mal saisie : touchez [[Modifier l’adresse]].",
        },
        {
          type: "callout",
          tone: "note",
          title: "Bon à savoir",
          text: "Le mot de passe est facultatif : sur l’écran du code, touchez [[Ajouter un mot de passe (facultatif)]] pour en choisir un (8 caractères minimum). Vous pourrez toujours vous connecter avec un code reçu par e-mail. Si l’adresse a déjà un compte, le même écran vous connecte simplement.",
        },
      ],
    },
    {
      id: "etape-2",
      title: "Créer votre projet",
      step: {
        number: 2,
        duration: "2 min",
        whatsapp: [
          "Dans [[Mes projets]], touchez [[Créer un projet]].",
          "**Nom du projet (Entreprise)** : le nom de votre entreprise.",
          "**Pays et numéro WhatsApp** : celui sur lequel vos clients vous écrivent.",
          "**Forfait** : Starter, Pro ou Business.",
          "Touchez [[Vérifier mon numéro]].",
        ],
      },
      blocks: [
        { type: "p", text: "Un projet correspond à un numéro WhatsApp : votre entreprise, son assistant, ses conversations et son équipe. Sur la page [[Mes projets]], touchez [[Créer un projet]], puis remplissez le formulaire de haut en bas." },
        {
          type: "steps",
          items: [
            "**Nom du projet (Entreprise)** : le nom de votre entreprise, tel que vos clients le connaissent.",
            "**Pays et numéro WhatsApp** : celui sur lequel vos clients vous écrivent. Choisissez le pays, ou commencez le numéro par l’indicatif (+241…) : le pays se sélectionne tout seul. Sur téléphone, la liste des pays s’ouvre avec une recherche par nom ou par indicatif.",
            "**Forfait** : Starter, Pro ou Business. Le bouton [[Inclus dans…]] détaille ce que comprend le forfait choisi. Vous pourrez en changer plus tard depuis la page [[Facturation]] du projet.",
            "Vérifiez le récapitulatif : **À payer aujourd’hui** affiche 0 $ pendant l’essai, suivi du prix mensuel du forfait. Touchez [[Vérifier mon numéro]].",
          ],
        },
        {
          type: "figure",
          figure: "projet",
          caption: "Interface simplifiée : les numéros renvoient aux étapes ci-dessus.",
          description: `Formulaire « Créer un projet » : nom du projet (Entreprise), pays, numéro WhatsApp avec indicatif, choix du forfait (${PLAN_PRICES} par mois), récapitulatif À payer aujourd’hui à 0 $ et bouton Vérifier mon numéro.`,
        },
        {
          type: "callout",
          tone: "note",
          title: "Bon à savoir",
          text: "Rien n’est enregistré avant la vérification du numéro. À l’écran suivant, [[Retour]] vous ramène au formulaire sans rien perdre, et [[Modifier]] permet de corriger le numéro.",
        },
      ],
    },
    {
      id: "etape-3",
      title: "Vérifier votre numéro et démarrer l’essai",
      step: {
        number: 3,
        duration: "1 min",
        whatsapp: [
          "Sur ordinateur, scannez le QR code avec le téléphone de ce numéro. Sur téléphone, touchez [[Ouvrir WhatsApp]].",
          "Envoyez le message prêt tel quel : il contient un code à 6 chiffres.",
          "Attendez [[Numéro vérifié]], puis touchez [[Continuer vers le paiement]].",
          "Autre méthode : [[Recevoir un code à la place]], puis saisissez les 6 chiffres reçus sur WhatsApp.",
          `Essai gratuit : ${TRIAL}, une fois par numéro. Rien à payer aujourd’hui.`,
        ],
      },
      blocks: [
        { type: "p", text: "ExtravertyAI s’assure que le numéro vous appartient : vous envoyez vous-même, depuis ce numéro, un message préparé qui contient un code à 6 chiffres. ExtravertyAI n’écrit jamais en premier à votre numéro." },
        {
          type: "steps",
          items: [
            "Sur ordinateur, scannez le QR code avec le téléphone de ce numéro : WhatsApp s’ouvre avec le message prêt. Sur téléphone, touchez [[Ouvrir WhatsApp]] ; sur Android, choisissez [[WhatsApp]] ou [[WhatsApp Business]].",
            "Envoyez le message tel quel, sans le modifier.",
            "Après quelques secondes, l’écran affiche [[Numéro vérifié]] et « Confirmé avec WhatsApp ».",
            "Touchez [[Continuer vers le paiement]]. Le paiement s’ouvre sur une page sécurisée ; une fois validé, vous revenez dans votre projet et la configuration de l’assistant s’ouvre.",
          ],
        },
        { type: "p", text: "Le téléphone est connecté au mauvais compte WhatsApp ? Touchez [[Copier]], puis envoyez le message depuis le bon compte, au numéro indiqué à l’écran." },
        { type: "p", text: "Vous préférez recevoir un code ? Touchez [[Recevoir un code à la place]] : ExtravertyAI vous l’envoie sur WhatsApp. Saisissez les 6 chiffres dans **Code reçu sur WhatsApp**, puis touchez [[Vérifier]]." },
        {
          type: "figure",
          figure: "verification",
          caption: "Interface simplifiée. Basculez entre les deux états avec les boutons au-dessus de l’aperçu.",
          description: "Écran « Vérifiez votre numéro » : un QR code à scanner, le code à 6 chiffres à envoyer avec le bouton Copier, le bouton Ouvrir WhatsApp, le lien Recevoir un code à la place ; puis l’écran « Numéro vérifié », « Confirmé avec WhatsApp », avec le bouton Continuer vers le paiement.",
        },
        {
          type: "callout",
          tone: "warning",
          title: "Attention",
          text: `L’essai gratuit (${TRIAL}) est accordé une seule fois par numéro. Si ce numéro en a déjà profité, l’écran affiche [[Essai déjà utilisé par ce numéro]] et propose [[Payer sans essai]] : le premier mois est alors prélevé à la validation du paiement. Un code expire au bout de 10 minutes ; une fois le numéro vérifié, vous avez 30 minutes pour ouvrir le paiement, sinon recommencez la vérification.`,
        },
      ],
    },
    {
      id: "etape-4",
      title: "Configurer votre assistant",
      step: {
        number: 4,
        duration: "8 min",
        whatsapp: [
          "**Entreprise** : nom, secteur, activité, et si vous voulez logo, site web et réseaux sociaux.",
          "**Objectifs** : ce que l’assistant doit prendre en charge (au moins un).",
          "**Profil** : nom, ton, longueur des réponses, langue et emojis.",
          "**Mission** : touchez [[Générer avec l’IA]], relisez les instructions, puis [[Modifier]] si besoin.",
          "**Connaissances** : informations, produits, documents (PDF ou page web).",
          "**Test** : posez des questions comme un client, puis cliquez sur [[Activer l’assistant]].",
        ],
      },
      blocks: [
        { type: "p", text: "Après le paiement, l’assistant de configuration s’ouvre. Il compte six écrans : **Entreprise**, **Objectifs**, **Profil**, **Mission**, **Connaissances** et **Test**. Le bouton [[Retour]] vous ramène à l’écran précédent sans rien perdre." },
      ],
    },
    {
      id: "entreprise",
      title: "Entreprise : présentez votre activité",
      level: 3,
      blocks: [
        {
          type: "bullets",
          items: [
            "**Logo** (facultatif) : il illustre votre projet dans l’application.",
            "**Nom de l’entreprise** : prérempli avec le nom du projet. Le modifier renomme aussi le projet.",
            "**Secteur d’activité** : commerce, restauration, santé, immobilier, transport…",
            "**Votre activité** : ce que vous vendez ou proposez, en une phrase au moins.",
            "**Site web et réseaux sociaux** (facultatif) : ils sont enregistrés dans les connaissances de l’assistant, inutile de les ajouter ailleurs.",
          ],
        },
        {
          type: "figure",
          figure: "entreprise",
          caption: "Interface simplifiée : écran Entreprise.",
          description: "Écran « Votre entreprise », étape 1 sur 6 : nom de l’entreprise, secteur d’activité, description de l’activité et bouton Continuer.",
        },
      ],
    },
    {
      id: "objectifs",
      title: "Objectifs : ce qu’il doit prendre en charge",
      level: 3,
      blocks: [
        { type: "p", text: "Cochez au moins un objectif. L’assistant s’en sert pour rédiger ses instructions à l’écran Mission." },
        {
          type: "bullets",
          items: [
            "**Répondre aux questions** : prix, horaires, livraison, disponibilités.",
            "**Vendre et prendre les commandes** : conseiller, récapituler, faire confirmer.",
            "**Qualifier les prospects** : besoin, budget, échéance.",
            "**Recueillir les rendez-vous** : demandes de réservation à confirmer.",
            "**Assurer le service client** : suivi, réclamations, après-vente.",
          ],
        },
      ],
    },
    {
      id: "profil",
      title: "Profil : présentez votre assistant",
      level: 3,
      blocks: [
        {
          type: "bullets",
          items: [
            "**Nom de votre agent** : le prénom qu’il donnera à vos clients, par exemple Nova.",
            "**Ton** : Chaleureux, Professionnel ou Direct.",
            "**Longueur des réponses** : Concis (recommandé sur WhatsApp), Équilibré ou Détaillé.",
            "**Langue** : s’adapter au client, toujours en français ou toujours en anglais.",
            "**Emojis** : un emoji au maximum par réponse, seulement s’il est pertinent, ou aucun.",
          ],
        },
        {
          type: "figure",
          figure: "profil",
          caption: "Interface simplifiée : écran Profil.",
          description: "Écran « Présentez votre assistant », étape 3 sur 6 : nom de l’agent (Nova), ton (Chaleureux, Professionnel, Direct) et longueur des réponses (Concis, Équilibré, Détaillé).",
        },
      ],
    },
    {
      id: "mission",
      title: "Mission : ses instructions",
      level: 3,
      blocks: [
        { type: "p", text: "Touchez [[Générer avec l’IA]] : l’assistant rédige ses instructions à partir de votre fiche Entreprise et de vos objectifs. Relisez-les, puis touchez [[Modifier]] pour ajouter une règle propre à votre activité. Les instructions comptent entre 40 et 12 000 caractères." },
        {
          type: "example",
          title: "Exemple de règle à ajouter",
          text: "Orienter vers un conseiller toute commande de plus de 100 000 FCFA. Ne jamais promettre de remise ni de délai de livraison qui ne figure pas dans les connaissances.",
        },
        { type: "p", text: "Choisissez ensuite ses **règles de conversation** :" },
        {
          type: "bullets",
          items: [
            "**Une question à la fois** : il fait avancer la conversation sans submerger le client.",
            "**Comprendre le besoin** : il identifie la demande et son échéance. Ce choix active aussi Instinct IA.",
            "**Proposer un conseiller** : il oriente vers votre équipe quand il n’a pas de réponse fiable. Il ne transfère jamais la conversation lui-même.",
          ],
        },
        {
          type: "callout",
          tone: "tip",
          title: "Astuce",
          text: "Relisez toujours le texte rédigé par l’IA : c’est votre version qui fait foi. Patientez 30 secondes entre deux demandes ; chaque projet dispose de 10 rédactions par 24 heures.",
        },
      ],
    },
    {
      id: "connaissances",
      title: "Connaissances : ce qu’il doit savoir",
      level: 3,
      blocks: [
        { type: "p", text: "C’est la mémoire de votre assistant. Il s’en sert pour répondre juste. Vous pourrez la compléter à tout moment depuis [[Assistant IA]]." },
        {
          type: "bullets",
          items: [
            "**Informations** : horaires, conditions de vente, questions fréquentes. Votre site web et vos réseaux sociaux y sont déjà.",
            "**Produits** : votre catalogue, avec les prix.",
            "**Documents** : un PDF ou l’adresse d’une page web (https://…). Leur contenu est lu en quelques instants.",
          ],
        },
        {
          type: "callout",
          tone: "note",
          title: "Bon à savoir",
          text: "L’assistant n’invente aucun prix, produit, délai ni disponibilité. Quand une information manque, il le dit et demande une précision, ou propose un conseiller si vous avez activé cette règle.",
        },
      ],
    },
    {
      id: "test",
      title: "Test : essayez-le comme un client",
      level: 3,
      blocks: [
        { type: "p", text: "Écrivez comme le ferait un client. L’assistant répond avec votre configuration réelle, **sans rien envoyer sur WhatsApp**. Quand ses réponses vous conviennent, cliquez sur [[Activer l’assistant]]." },
        {
          type: "figure",
          figure: "test",
          caption: "Démonstration : réponses d’exemple pour une boutique fictive.",
          description: "Écran « Testez-le comme un client » : une conversation de test avec l’assistant Nova, des questions suggérées et le bouton Activer l’assistant.",
        },
        {
          type: "callout",
          tone: "warning",
          title: "Attention",
          text: "Seul un propriétaire ou un administrateur du projet peut terminer cette configuration. Les autres membres voient le message « Votre assistant se prépare » en attendant.",
        },
      ],
    },
    {
      id: "etape-5",
      title: "Connecter WhatsApp",
      step: {
        number: 5,
        duration: "1 min",
        whatsapp: [
          "Ouvrez WhatsApp sur votre téléphone.",
          "Android : menu ⋮ puis [[Appareils connectés]]. iPhone : [[Réglages]] puis [[Appareils connectés]].",
          "Touchez [[Connecter un appareil]].",
          "Visez le QR code affiché sur l’ordinateur.",
          "Sans second écran : choisissez [[Numéro de téléphone]] et saisissez le code dans WhatsApp.",
        ],
      },
      blocks: [
        { type: "p", text: "Dernière étape : relier votre numéro à ExtravertyAI. Votre téléphone reste utilisable normalement. ExtravertyAI s’ajoute à vos appareils connectés, comme WhatsApp Web." },
        {
          type: "steps",
          items: [
            "Ouvrez [[WhatsApp]] sur votre téléphone.",
            "Android : touchez le menu ⋮, puis [[Appareils connectés]]. iPhone : touchez [[Réglages]], puis [[Appareils connectés]].",
            "Touchez [[Connecter un appareil]].",
            "Visez le QR code affiché à l’écran de votre ordinateur.",
          ],
        },
        { type: "p", text: "Pas de second écran sous la main ? Choisissez [[Numéro de téléphone]] : un code de 8 caractères s’affiche. Sur votre téléphone, touchez [[Connecter avec un numéro de téléphone]] et saisissez-le." },
        {
          type: "figure",
          figure: "connexion",
          caption: "À gauche, l’écran ExtravertyAI ; à droite, votre téléphone. Le code affiché est un exemple.",
          description: "Écran « Connexion à WhatsApp » avec le choix QR code ou Numéro de téléphone, les quatre étapes à suivre, et sur le téléphone l’écran Appareils connectés avec le bouton Connecter un appareil.",
        },
        {
          type: "callout",
          tone: "warning",
          title: "Attention",
          text: "Scannez avec le téléphone du numéro vérifié à l’étape 3. Ne partagez jamais le QR code ni le code de connexion : ils donnent accès à vos conversations.",
        },
        {
          type: "callout",
          tone: "success",
          title: "C’est en ligne",
          text: "Quand [[WhatsApp est connecté]] s’affiche, vos conversations s’ouvrent. L’assistant répond désormais aux messages de vos clients.",
        },
      ],
    },
    {
      id: "ensuite",
      title: "Ce qui se passe ensuite",
      blocks: [
        { type: "p", text: "Chaque message client est traité par l’assistant, qui s’appuie sur vos connaissances. Votre équipe voit tout dans la messagerie et peut répondre elle-même à tout moment : il suffit de cliquer sur [[Répondre]], et l’IA se retire de cette conversation." },
        {
          type: "figure",
          figure: "circuit",
          caption: "Sur petit écran, faites glisser le schéma horizontalement.",
          description: "Le client écrit sur WhatsApp ; l’assistant IA répond en s’appuyant sur vos connaissances ; Instinct IA (Pro et Business) classe le contact en Intéressant, À relancer ou Aucun ; votre équipe peut cliquer sur Répondre pour reprendre la conversation.",
        },
        {
          type: "next",
          items: [
            { slug: "reprendre", title: "Reprendre la main", text: "Répondre vous-même à un client, sans doublon." },
            { slug: "connaissances", title: "Compléter les connaissances", text: "Ajouter produits, PDF et questions fréquentes." },
            { slug: "equipe", title: "Inviter votre équipe", text: "Partager la messagerie avec vos collègues." },
          ],
        },
      ],
    },
    {
      id: "faq",
      title: "Questions fréquentes",
      blocks: [
        {
          type: "faq",
          items: [
            { question: "Puis-je garder mon numéro WhatsApp actuel ?", answer: "Oui, avec WhatsApp comme avec WhatsApp Business. Vous continuez à utiliser l’application sur votre téléphone : ExtravertyAI s’ajoute simplement à vos appareils connectés." },
            { question: "Quand l’assistant commence-t-il à répondre ?", answer: "Dès que deux conditions sont réunies : l’assistant est activé (étape 4) et WhatsApp est connecté (étape 5). Avant cela, aucun client ne reçoit de réponse automatique." },
            { question: "Le test envoie-t-il des messages à mes clients ?", answer: "Non. Le test de l’étape 4 se passe entièrement dans ExtravertyAI. Rien n’est envoyé sur WhatsApp." },
            { question: "Que comprend l’essai gratuit ?", answer: `${TRIAL[0].toUpperCase()}${TRIAL.slice(1)}, une seule fois par numéro WhatsApp. Si le numéro a déjà profité d’un essai, vous pouvez payer directement avec [[Payer sans essai]].` },
            { question: "Dois-je choisir un mot de passe ?", answer: "Non. Vous vous connectez avec un code reçu par e-mail, ou avec Google. Si vous le souhaitez, ajoutez un mot de passe sur l’écran du code à l’inscription : 8 caractères minimum." },
            { question: "Je n’ai pas reçu le code de vérification du numéro.", answer: "Vérifiez le numéro affiché (touchez [[Modifier]] pour le corriger), puis touchez [[Renvoyer le code]]. Vous pouvez aussi revenir à la méthode par message avec [[Envoyer un message à la place]]." },
            { question: "Le QR code ne fonctionne pas.", answer: "Un QR code expire vite : demandez-en un nouveau. Augmentez la luminosité de l’écran et tenez le téléphone à 20 cm environ. Si cela ne suffit pas, choisissez [[Numéro de téléphone]] et saisissez le code affiché dans WhatsApp." },
            { question: "Un collègue peut-il configurer l’assistant à ma place ?", answer: "Oui, s’il est propriétaire ou administrateur du projet. Invitez-le depuis la page [[Équipe]] avec le rôle adapté." },
          ],
        },
      ],
    },
  ],
};

export const HELP_ARTICLES: HelpArticle[] = [
  GUIDE,
  brief({
    slug: "compte",
    title: "Créer et sécuriser votre compte",
    groupId: "prise-en-main",
    summary: "Votre compte vous identifie dans tous vos projets. Il suffit d’un nom et d’une adresse e-mail, ou d’un compte Google : aucun mot de passe n’est obligatoire.",
    keywords: ["inscription", "google", "e-mail", "email", "code", "mot de passe", "mot de passe oublié", "connexion", "se connecter"],
    points: [
      "Inscription : votre nom et votre adresse e-mail, puis le code à 6 chiffres reçu par e-mail. Il confirme l’adresse, crée le compte et vous connecte. Ou en un clic avec [[Continuer avec Google]].",
      "Mot de passe facultatif : ajoutez-le sur l’écran du code avec [[Ajouter un mot de passe (facultatif)]], 8 caractères minimum.",
      "Connexion : par code reçu par e-mail, par défaut ; par mot de passe si vous en avez choisi un ; ou avec Google.",
      "Un code expire au bout de 10 minutes. Rien reçu ? Regardez vos courriers indésirables, puis touchez [[Renvoyer le code]].",
      "Mot de passe oublié : connectez-vous avec un code reçu par e-mail, ou utilisez le lien [[Mot de passe oublié ?]] de la page de connexion.",
      "Un même compte peut appartenir à plusieurs projets, par exemple si vous gérez deux entreprises.",
    ],
  }),
  brief({
    slug: "forfaits",
    title: "Choisir votre forfait",
    groupId: "prise-en-main",
    summary: `Trois forfaits mensuels, un numéro WhatsApp par projet. Chaque nouvel abonnement commence par un essai gratuit de ${TRIAL_DAYS} jours.`,
    keywords: ["prix", "tarif", "abonnement", "starter", "pro", "business", "essai gratuit", "comparer"],
    points: [
      `Essai gratuit : ${TRIAL}, une fois par numéro WhatsApp.`,
      "Changez de forfait depuis la page [[Facturation]] de votre projet.",
    ],
    extra: [
      {
        id: "comparatif",
        title: "Comparer les forfaits",
        blocks: [
          {
            type: "table",
            caption: "Comparatif des forfaits ExtravertyAI",
            head: ["", ...perPlan((plan) => plan.name)],
            rows: [
              ["Prix par mois", ...perPlan((plan) => formatPlanPrice(plan.priceCents))],
              ["Utilisateurs", ...perPlan((plan) => String(plan.users))],
              ["Messages par mois", ...perPlan((plan) => formatCount(plan.messageLimit))],
              ["1 000 messages en plus", ...perPlan((plan) => formatPlanPrice(plan.extraPackCents))],
              ["Notes vocales", "Non", "Oui", "Oui"],
              ["Images", "Non", "Non", "Oui"],
              ["Instinct IA et résumés", "Non", "Oui", "Oui"],
              ["Pipeline et relances", "Non", "Non", "Oui"],
              ["Historique des statistiques", "30 jours", "90 jours", "12 mois"],
              ["Fichiers", ...perPlan((plan) => plan.storage)],
            ],
            note: "Prix mensuels en dollars américains.",
          },
        ],
      },
    ],
  }),
  brief({
    slug: "entreprise",
    title: "Fiche entreprise et objectifs",
    groupId: "assistant",
    summary: "La fiche entreprise et les objectifs donnent à l’assistant le contexte de votre activité. Ils servent aussi à rédiger ses instructions.",
    keywords: ["entreprise", "secteur", "activité", "logo", "site web", "réseaux sociaux", "objectifs", "fiche"],
    points: [
      "Fiche entreprise : logo (facultatif), nom, secteur d’activité, description de l’activité, site web et réseaux sociaux.",
      "Modifier le nom de l’entreprise renomme aussi le projet.",
      "Le site web et les réseaux sociaux sont enregistrés dans l’onglet Informations des connaissances.",
      "Objectifs : répondre aux questions, vendre et prendre les commandes, qualifier les prospects, recueillir les rendez-vous, assurer le service client.",
      "Seuls les propriétaires et administrateurs modifient la fiche.",
    ],
  }),
  brief({
    slug: "personnalite",
    title: "Personnalité et instructions",
    groupId: "assistant",
    summary: "Le profil et la mission définissent comment votre assistant parle et ce qu’il fait. Vous les modifiez à tout moment depuis Assistant IA.",
    keywords: ["ton", "longueur", "langue", "nom agent", "règles", "mission", "instructions", "emoji", "conseiller", "générer"],
    points: [
      "Ton : Chaleureux, Professionnel ou Direct.",
      "Longueur : Concis (recommandé sur WhatsApp), Équilibré ou Détaillé.",
      "Langue : s’adapter au client, toujours en français ou toujours en anglais.",
      "Instructions : [[Générer avec l’IA]] les rédige à partir de votre fiche entreprise ; [[Modifier]] permet de les ajuster (40 à 12 000 caractères).",
      "Règles de conversation : une question à la fois, comprendre le besoin, proposer un conseiller.",
    ],
  }),
  brief({
    slug: "connaissances",
    title: "Ajouter des connaissances",
    groupId: "assistant",
    summary: "Les connaissances sont la mémoire de votre assistant : il s’en sert pour répondre juste et n’invente rien de ce qui n’y figure pas.",
    keywords: ["base de connaissances", "pdf", "document", "page web", "site", "produits", "catalogue", "prix", "faq", "importer"],
    points: [
      "Informations : horaires, conditions de vente, questions fréquentes.",
      "Produits : votre catalogue avec ses prix.",
      "Documents : importez un PDF ou l’adresse d’une page web en https://. Le contenu est lu en quelques instants.",
      "Une réponse corrigée dans une conversation peut être ajoutée aux connaissances en un clic.",
    ],
  }),
  brief({
    slug: "tester",
    title: "Tester avant d’activer",
    groupId: "assistant",
    summary: "Le test montre ce que l’assistant répondrait, avec votre configuration réelle, sans rien envoyer sur WhatsApp.",
    keywords: ["test", "simulation", "essayer", "activer assistant"],
    points: [
      "Posez les questions que vos clients posent vraiment : prix, livraison, horaires.",
      "Si une réponse ne convient pas, corrigez les instructions ou ajoutez l’information manquante, puis testez de nouveau.",
      "Activez l’assistant seulement quand ses réponses vous conviennent.",
    ],
  }),
  brief({
    slug: "ameliorer",
    title: "Améliorer les réponses",
    groupId: "assistant",
    summary: "Chaque réponse de l’IA peut être évaluée depuis la conversation. Vos corrections enrichissent les connaissances de l’assistant.",
    keywords: ["évaluer", "noter", "corriger", "réponse ia", "amélioration"],
    points: [
      "Ouvrez la conversation et évaluez la réponse de l’IA.",
      "Proposez la bonne réponse : elle peut être ajoutée à l’Assistant IA immédiatement, et l’équipe est prévenue.",
      "Les questions restées sans réponse fiable sont de bonnes candidates pour une nouvelle information.",
    ],
  }),
  brief({
    slug: "messagerie",
    title: "La messagerie partagée",
    groupId: "conversations",
    summary: "Toutes les conversations WhatsApp de votre numéro, en temps réel, pour toute l’équipe.",
    keywords: ["boîte de réception", "conversations", "temps réel", "statut", "lu", "distribué", "notes internes", "résumé"],
    points: [
      "Suivez l’état de chaque message : envoyé, distribué, lu.",
      "Ajoutez des notes internes : seule votre équipe les voit.",
      "Résumé IA de chaque conversation avec les forfaits Pro et Business.",
      "Envoyez des notes vocales depuis la messagerie.",
    ],
  }),
  brief({
    slug: "reprendre",
    title: "Reprendre la main sur l’IA",
    groupId: "conversations",
    summary: "Vous pouvez répondre vous-même à n’importe quel client, à tout moment. L’assistant se retire aussitôt de cette conversation.",
    keywords: ["reprendre la main", "humain", "répondre moi-même", "pause ia", "conversation"],
    points: [
      "Ouvrez la conversation et cliquez sur [[Répondre]].",
      "Les réponses automatiques en attente pour ce contact sont annulées : le client ne reçoit pas deux réponses.",
      "Les relances automatiques ne concernent pas les conversations reprises par un membre.",
    ],
  }),
  brief({
    slug: "medias",
    title: "Notes vocales et images",
    groupId: "conversations",
    summary: "Selon votre forfait, l’assistant comprend plus que du texte.",
    keywords: ["audio", "vocal", "note vocale", "transcription", "image", "photo", "analyse"],
    points: [
      "Starter : l’assistant répond aux messages texte.",
      "Pro et Business : les notes vocales des clients sont transcrites et prises en compte.",
      "Business : les images envoyées par les clients sont aussi analysées.",
    ],
  }),
  brief({
    slug: "instinct",
    title: "Instinct IA : qualifier vos prospects",
    groupId: "ventes",
    plan: "Pro et Business",
    summary: "Instinct IA classe automatiquement chaque client selon ce qu’il exprime dans la conversation.",
    keywords: ["instinct", "qualification", "prospect", "intéressant", "relancer", "lead", "classement"],
    points: [
      "Intéressant : il demande un devis, un prix ou veut commander.",
      "À relancer : il hésite ou reporte sa décision.",
      "Aucun : pas d’intention d’achat détectée.",
      "Activez la règle **Comprendre le besoin** dans la mission de l’assistant.",
    ],
  }),
  brief({
    slug: "pipeline",
    title: "Pipeline et relances automatiques",
    groupId: "ventes",
    plan: "Business",
    summary: "Suivez vos prospects par étape et laissez l’IA relancer ceux qui restent silencieux, au bon moment.",
    keywords: ["pipeline", "étapes", "relance automatique", "suivi", "devis envoyé", "stop"],
    points: [
      "Les relances concernent les prospects aux étapes Intéressé et Devis envoyé.",
      "Choisissez le délai (de 1 à 14 jours) et le nombre de relances (1 à 3 par prospect).",
      "Les envois partent entre 8 h et 20 h, à l’heure de votre projet.",
      "Aucune relance si le client a écrit STOP ou si un membre a repris la conversation.",
      "Désactivées par défaut : un propriétaire ou un administrateur les active depuis [[Pipeline]], puis [[Configurer]].",
    ],
  }),
  brief({
    slug: "diffusions",
    title: "Diffusions",
    groupId: "ventes",
    plan: "Pro et Business",
    summary: "Envoyez un même message, personnalisé avec le prénom, aux contacts qui vous ont déjà écrit.",
    keywords: ["diffusion", "envoi groupé", "campagne", "message de masse"],
    points: [
      "Pro : jusqu’à 500 contacts par envoi et 2 000 messages de diffusion par mois.",
      "Business : jusqu’à 2 000 contacts par envoi et 10 000 messages par mois, avec ciblage par étape du pipeline.",
      "Seuls les contacts qui vous ont déjà écrit peuvent être ciblés : cela protège votre numéro contre les signalements.",
      "Chaque message de diffusion compte aussi dans le quota mensuel de votre forfait.",
    ],
  }),
  brief({
    slug: "statistiques",
    title: "Dashboard et Analytics",
    groupId: "pilotage",
    summary: "Mesurez l’activité de votre numéro : messages reçus, nouvelles discussions, temps de première réponse, part des réponses de l’IA.",
    keywords: ["statistiques", "tableau de bord", "analytics", "chiffres", "graphiques", "satisfaction"],
    points: [
      "Historique : 30 jours (Starter), 90 jours (Pro), 12 mois (Business).",
      "Questionnaire de satisfaction des clients à partir du forfait Pro.",
    ],
  }),
  brief({
    slug: "rapports",
    title: "Rapports et exports",
    groupId: "pilotage",
    summary: "Récupérez vos données et partagez vos chiffres avec votre équipe.",
    keywords: ["rapport hebdomadaire", "export", "csv", "excel", "pdf", "word", "télécharger"],
    points: [
      "Export CSV des contacts avec tous les forfaits.",
      "Exports Excel, PDF et Word des rapports.",
      "Business : rapports programmés envoyés chaque semaine par e-mail.",
    ],
  }),
  brief({
    slug: "equipe",
    title: "Équipe, rôles et invitations",
    groupId: "equipe",
    summary: "Invitez vos collègues pour répondre aux clients ensemble.",
    keywords: ["équipe", "membre", "inviter", "invitation", "rôle", "administrateur", "propriétaire", "répartition"],
    points: [
      `Utilisateurs inclus : ${perPlan((plan) => `${plan.users} (${plan.name})`).join(", ")}.`,
      "Invitez par e-mail ; le rôle de chaque membre définit ce qu’il peut faire.",
      "Seuls les propriétaires et administrateurs gèrent la configuration de l’assistant.",
      "Business : répartition automatique des conversations entre les membres.",
    ],
  }),
  brief({
    slug: "integrations",
    title: "Intégrations",
    groupId: "equipe",
    summary: "Envoyez vos contacts et vos événements vers vos autres outils.",
    keywords: ["webhook", "google sheets", "make", "zapier", "intégration"],
    points: [
      "Google Sheets : inclus dans tous les forfaits. ExtravertyAI n’accède qu’à la feuille qu’il crée.",
      "Webhooks (Make, Zapier ou votre propre outil) : à partir du forfait Pro.",
      "Les événements disponibles suivent votre forfait, par exemple la qualification Instinct IA à partir de Pro.",
    ],
  }),
  brief({
    slug: "abonnement",
    title: "Abonnement et recharges",
    groupId: "facturation",
    summary: "Votre forfait inclut un nombre de messages par mois. Au-delà, rechargez par paquets de 1 000 messages.",
    keywords: ["facture", "paiement", "recharge", "quota", "messages", "changer de forfait", "remboursement"],
    points: [
      `Recharge de 1 000 messages : ${perPlan((plan) => `${formatPlanPrice(plan.extraPackCents)} (${plan.name})`).join(", ")}.`,
      "Changez de forfait ou retrouvez vos factures depuis la page [[Facturation]].",
      "Politique de remboursement : [extravertyai.com/remboursement](https://www.extravertyai.com/remboursement).",
    ],
  }),
  brief({
    slug: "parametres",
    title: "Paramètres du projet",
    groupId: "facturation",
    summary: "Le nom, le logo et le fuseau horaire de votre projet, ainsi que vos préférences WhatsApp.",
    keywords: ["paramètres", "nom", "logo", "fuseau horaire", "préférences whatsapp", "transférer", "supprimer projet"],
    points: [
      "Le fuseau horaire sert aux statistiques, aux rapports et aux horaires des relances.",
      "Transférez la propriété du projet à un autre membre.",
      "Supprimez le projet depuis la zone dédiée des paramètres.",
    ],
  }),
  {
    slug: "faq",
    title: "Questions fréquentes",
    groupId: "aide",
    summary: "Les réponses aux questions que l’on nous pose le plus souvent.",
    keywords: ["faq", "question", "réponse", "problème"],
    sections: [
      {
        id: "questions",
        title: "Les questions",
        blocks: [
          {
            type: "faq",
            items: [
              { question: "Combien de numéros WhatsApp par projet ?", answer: "Un seul. Pour un deuxième numéro, créez un deuxième projet depuis [[Mes projets]]." },
              { question: "Puis-je utiliser WhatsApp Business ?", answer: "Oui. ExtravertyAI fonctionne avec WhatsApp et avec WhatsApp Business." },
              { question: "Mon téléphone doit-il rester allumé ?", answer: "Pas en permanence. Connectez-le à Internet régulièrement : WhatsApp déconnecte les appareils liés d’un téléphone resté longtemps hors ligne." },
              { question: "Que se passe-t-il quand mon quota de messages est atteint ?", answer: "Achetez une recharge de 1 000 messages ou passez au forfait supérieur depuis la page [[Facturation]]." },
              { question: "Où sont conservées mes données ?", answer: "Tout est expliqué sur la page [Données et confidentialité](https://www.extravertyai.com/donneesEtConfidentialite)." },
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "contact",
    title: "Contacter l’équipe",
    groupId: "aide",
    summary: "Une question sans réponse ici ? L’équipe ExtravertyAI vous répond sur WhatsApp.",
    keywords: ["contact", "support", "humain", "whatsapp", "téléphone", "joindre", "bouton aide"],
    sections: [
      {
        id: "application",
        title: "Depuis l’application",
        blocks: [
          { type: "p", text: "En haut de chaque page de l’application, touchez [[Aide]] : l’article qui explique la page ouverte s’affiche dans un nouvel onglet, sans perdre ce que vous étiez en train de saisir. Tous les guides restent accessibles depuis le menu de votre compte, rubrique [[Centre d’aide]]." },
        ],
      },
      {
        id: "whatsapp",
        title: "Sur WhatsApp",
        blocks: [
          { type: "p", text: `Écrivez-nous au **${SUPPORT_WHATSAPP_DISPLAY}** ([wa.me/24176205629](https://wa.me/24176205629)). Précisez le nom de votre projet et décrivez ce que vous voyez à l’écran : nous irons plus vite.` },
        ],
      },
      {
        id: "site",
        title: "Par le site",
        blocks: [
          { type: "p", text: "Vous pouvez aussi passer par la page [extravertyai.com/contact](https://www.extravertyai.com/contact)." },
        ],
      },
    ],
  },
];
