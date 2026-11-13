import type { Metadata } from "next";
import Link from "next/link";
import {
  Ban,
  Bot,
  CalendarClock,
  CircleSlash,
  CreditCard,
  FileText,
  Gauge,
  Handshake,
  RefreshCw,
  Scale,
  ServerCog,
  ShieldAlert,
  UserCheck,
} from "lucide-react";

import { LegalPage, type LegalSection } from "@/components/website/legal-page";

export const metadata: Metadata = {
  title: "Conditions d’utilisation | ExtravertyAI",
  description:
    "Les règles d’utilisation d’ExtravertyAI : essai, abonnement, usages autorisés, responsabilités et résiliation.",
  alternates: { canonical: "/conditions" },
};
export const dynamic = "force-static";

const highlights = [
  { icon: CalendarClock, title: "10 jours d’essai", text: "Annulez avant la fin : aucun prélèvement." },
  { icon: RefreshCw, title: "Sans engagement", text: "Abonnement mensuel, résiliable à tout moment." },
  { icon: ShieldAlert, title: "Connexion type WhatsApp Web", text: "Hors API officielle de Meta : un risque de restriction existe, que l’application limite." },
];

const sections: LegalSection[] = [
  {
    id: "service",
    icon: Bot,
    title: "Le service",
    body: (
      <p>
        ExtravertyAI est un logiciel en ligne qui connecte le numéro WhatsApp
        d’une entreprise à un assistant d’intelligence artificielle. Il répond à
        ses clients, qualifie ses prospects et permet à son équipe de reprendre
        une conversation à tout moment. En créant un compte ou en utilisant le
        service, vous acceptez ces conditions.
      </p>
    ),
  },
  {
    id: "whatsapp",
    icon: ShieldAlert,
    title: "Connexion à WhatsApp",
    body: (
      <>
        <p>
          Votre numéro est relié à ExtravertyAI comme un appareil associé, de la
          même façon que WhatsApp Web, grâce au logiciel libre Evolution API.
          ExtravertyAI n’utilise pas l’API WhatsApp Business de Meta : c’est un
          service indépendant, qui n’est ni affilié à Meta ou à WhatsApp, ni
          approuvé par eux.
        </p>
        <p>En connectant un numéro, vous reconnaissez que :</p>
        <ul>
          <li>
            ce mode de connexion n’est pas un service officiel de WhatsApp, dont
            les conditions ne le prévoient pas ; WhatsApp peut donc, selon ses
            propres règles, limiter, suspendre ou bloquer un numéro, y compris
            utilisé de bonne foi ;
          </li>
          <li>
            nous ne pouvons pas revenir sur une décision de WhatsApp, ni
            récupérer l’accès au numéro ou à ses conversations ;
          </li>
          <li>
            une telle décision ne relève pas d’ExtravertyAI et n’ouvre pas droit
            à un dédommagement ; vous restez libre de résilier votre abonnement
            à tout moment ;
          </li>
          <li>
            vous choisissez le numéro à connecter : nous vous recommandons un
            numéro dédié à votre activité plutôt que votre numéro personnel.
          </li>
        </ul>
        <p>
          Pour limiter ce risque, l’application applique à tous les projets les
          protections suivantes :
        </p>
        <ul>
          <li>
            une diffusion ne part qu’aux personnes qui vous ont déjà écrit, et
            aucune liste de numéros ne peut être importée ;
          </li>
          <li>
            chaque diffusion propose de répondre STOP ; le contact ne reçoit
            alors plus ni diffusion ni relance ;
          </li>
          <li>
            les messages d’une diffusion sont espacés de 8 à 15 secondes, au
            hasard, et les relances d’au moins 20 secondes ;
          </li>
          <li>
            diffusions et relances ne partent qu’entre 8 h et 20 h, à l’heure
            de vos clients, dans des plafonds quotidiens et mensuels propres à
            chaque offre ;
          </li>
          <li>
            les relances sont désactivées par défaut et limitées à trois par
            prospect ; l’indication « en train d’écrire » précède chaque envoi.
          </li>
        </ul>
        <p>
          Ces protections réduisent le risque sans pouvoir le supprimer. Votre
          part compte aussi : n’écrivez qu’aux personnes qui vous ont contacté
          ou qui ont donné leur accord, et gardez des diffusions raisonnables
          (voir{" "}
          <Link href="#usages" className="underline underline-offset-4">
            Usages interdits
          </Link>
          ).
        </p>
      </>
    ),
  },
  {
    id: "compte",
    icon: UserCheck,
    title: "Votre compte",
    body: (
      <ul>
        <li>Le service s’adresse aux professionnels et aux entreprises.</li>
        <li>
          Vous devez fournir des informations exactes et garder vos accès
          confidentiels.
        </li>
        <li>
          Vous êtes responsable des actions réalisées depuis votre compte et par
          les membres que vous invitez.
        </li>
      </ul>
    ),
  },
  {
    id: "essai",
    icon: CalendarClock,
    title: "Essai gratuit",
    body: (
      <p>
        Chaque nouvel abonnement peut bénéficier d’un essai gratuit de 10 jours,
        limité à 150 messages. Un moyen de paiement est demandé au départ. Sans
        annulation avant la fin de l’essai, l’abonnement choisi démarre et le
        premier mois est prélevé automatiquement. Nous pouvons refuser un nouvel
        essai à un client qui en a déjà bénéficié.
      </p>
    ),
  },
  {
    id: "abonnement",
    icon: CreditCard,
    title: "Abonnement et paiement",
    body: (
      <>
        <p>
          Les abonnements sont mensuels et se renouvellent automatiquement. Le
          prix en vigueur et les limites de chaque forfait figurent sur la page
          des tarifs. Le paiement est traité par un prestataire spécialisé, qui
          peut apparaître comme vendeur sur votre reçu et appliquer les taxes
          dues ou proposer votre devise locale.
        </p>
        <p>
          En cas d’échec de paiement, l’accès aux réponses automatiques peut être
          suspendu jusqu’à régularisation. Tout changement de prix vous sera
          annoncé avant son application.
        </p>
      </>
    ),
  },
  {
    id: "quotas",
    icon: Gauge,
    title: "Quotas de messages",
    body: (
      <p>
        Chaque forfait inclut un volume de messages par période de facturation.
        Une fois ce volume atteint, l’assistant peut cesser de répondre
        automatiquement jusqu’à la période suivante ou jusqu’au passage à un
        forfait supérieur. Les messages non utilisés ne sont pas reportés.
      </p>
    ),
  },
  {
    id: "resiliation",
    icon: CircleSlash,
    title: "Résiliation et remboursement",
    body: (
      <p>
        Vous pouvez résilier depuis votre espace de facturation. L’accès reste
        ouvert jusqu’à la fin de la période déjà payée. Les remboursements sont
        décrits dans notre{" "}
        <Link href="/remboursement">politique de remboursement</Link>. Vous
        pouvez supprimer un projet ou votre compte selon les modalités prévues
        dans notre{" "}
        <Link href="/donneesEtConfidentialite">
          politique de confidentialité
        </Link>
        .
      </p>
    ),
  },
  {
    id: "usages",
    icon: Ban,
    title: "Usages interdits",
    body: (
      <>
        <p>Vous vous engagez à ne pas utiliser ExtravertyAI pour :</p>
        <ul>
          <li>
            envoyer du spam, ou des messages de diffusion à des personnes qui
            n’ont pas donné leur accord ;
          </li>
          <li>
            tromper, harceler, usurper une identité ou promouvoir des produits
            ou activités illégaux ;
          </li>
          <li>
            enfreindre les règles de WhatsApp, les lois applicables ou les droits
            d’un tiers ;
          </li>
          <li>
            contourner les limites du service, compromettre sa sécurité ou
            extraire ses données de façon automatisée.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "contenus",
    icon: FileText,
    title: "Vos contenus et vos clients",
    body: (
      <p>
        Vous restez propriétaire de vos contenus. Vous nous autorisez à les
        traiter uniquement pour fournir le service. Vous êtes responsable des
        informations données à l’assistant, de la base légale de vos échanges et
        de l’information de vos propres clients sur l’usage de l’IA.
      </p>
    ),
  },
  {
    id: "ia",
    icon: Bot,
    title: "Réponses de l’IA",
    body: (
      <p>
        Les réponses générées peuvent être incomplètes ou inexactes. Il vous
        appartient de vérifier la configuration de votre assistant et de
        reprendre les conversations sensibles. L’assistant ne remplace pas un
        conseil médical, juridique ou financier.
      </p>
    ),
  },
  {
    id: "disponibilite",
    icon: ServerCog,
    title: "Disponibilité et services tiers",
    body: (
      <p>
        Nous faisons notre possible pour assurer un service fiable, sans garantir
        une disponibilité ininterrompue. Le service dépend de tiers, notamment
        WhatsApp, les hébergeurs et les fournisseurs de modèles d’IA. Leur
        indisponibilité, ou la restriction d’un numéro par WhatsApp (voir
        l’article « Connexion à WhatsApp »), peut affecter le fonctionnement du
        service.
      </p>
    ),
  },
  {
    id: "responsabilite",
    icon: Handshake,
    title: "Suspension et responsabilité",
    body: (
      <p>
        Nous pouvons suspendre un compte en cas de non-respect de ces conditions
        ou de risque pour le service. Dans les limites permises par la loi, nous
        ne répondons pas des pertes indirectes comme la perte de clients ou de
        chiffre d’affaires.
      </p>
    ),
  },
  {
    id: "modifications",
    icon: Scale,
    title: "Modifications et litiges",
    body: (
      <p>
        Nous pouvons mettre à jour ces conditions. Toute modification importante
        sera annoncée avant son entrée en vigueur. Nous cherchons d’abord une
        solution amiable à tout litige.
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      eyebrowIcon={FileText}
      title="Conditions d’utilisation"
      intro="Les règles qui encadrent votre utilisation d’ExtravertyAI, écrites le plus simplement possible."
      updatedLabel="13 novembre 2026"
      updatedDate="2026-11-13"
      highlights={highlights}
      sections={sections}
      contactTitle="Une question sur ces conditions ?"
      contactText="Notre équipe vous répond directement avant ou après votre inscription."
      whatsAppMessage="Bonjour, j'ai une question concernant les conditions d'utilisation d'ExtravertyAI."
    />
  );
}
