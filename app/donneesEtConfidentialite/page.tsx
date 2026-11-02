import type { Metadata } from "next";
import { Ban, Cog, Database, Lock, Scale, Share2, ShieldCheck, Trash2 } from "lucide-react";

import { LegalPage, type LegalSection } from "@/components/website/legal-page";

export const metadata: Metadata = {
  title: "Données et confidentialité | ExtravertyAI",
  description:
    "Comment ExtravertyAI collecte, utilise et protège vos données et celles de vos clients.",
  alternates: { canonical: "/donneesEtConfidentialite" },
};
export const dynamic = "force-static";

const LAST_UPDATED = "12 juin 2026";

const highlights = [
  { icon: Ban, title: "Jamais revendues", text: "Ni vos données, ni celles de vos clients." },
  { icon: Lock, title: "Chiffrées en transit", text: "TLS/SSL et accès strictement contrôlés." },
  { icon: Trash2, title: "Supprimables", text: "Accès, export ou suppression à tout moment." },
];

const sections: LegalSection[] = [
  {
    id: "collecte",
    icon: Database,
    title: "Données collectées",
    body: (
      <>
        <p>
          Dans le cadre de l’utilisation de nos services d’automatisation, nous
          collectons différents types d’informations :
        </p>
        <ul>
          <li>
            <strong>Informations de compte :</strong> nom, adresse e-mail,
            informations de facturation de votre entreprise.
          </li>
          <li>
            <strong>Données d’intégration :</strong> numéros WhatsApp
            professionnels pour la configuration des webhooks nécessaires au
            fonctionnement de nos agents.
          </li>
          <li>
            <strong>Données de traitement :</strong> les flux de messages
            traités par nos systèmes d’intelligence artificielle pour le compte
            de votre support client.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "utilisation",
    icon: Cog,
    title: "Utilisation des données",
    body: (
      <>
        <p>Nous utilisons vos données exclusivement pour :</p>
        <ul>
          <li>Fournir, opérer et maintenir nos services d’agents IA.</li>
          <li>Améliorer la logique de nos systèmes et la précision des réponses automatisées.</li>
          <li>Assurer le support technique et répondre à vos demandes.</li>
          <li>Traiter les transactions via nos prestataires de paiement sécurisés.</li>
        </ul>
      </>
    ),
  },
  {
    id: "partage",
    icon: Share2,
    title: "Partage et tiers",
    body: (
      <p>
        ExtravertyAI ne vend <strong>jamais</strong> vos données personnelles ni
        celles de vos clients. Nous partageons certaines informations uniquement
        avec des fournisseurs d’infrastructure cloud de confiance (hébergement,
        bases de données, modèles de langage) strictement nécessaires à
        l’exécution de notre service, dans le cadre d’accords de confidentialité
        rigoureux.
      </p>
    ),
  },
  {
    id: "securite",
    icon: Lock,
    title: "Sécurité",
    body: (
      <p>
        Nous mettons en œuvre des mesures de sécurité de niveau entreprise pour
        protéger vos informations. Les données en transit sont chiffrées via
        TLS/SSL, et les données au repos sont stockées dans des bases de données
        sécurisées avec des accès strictement contrôlés et authentifiés.
      </p>
    ),
  },
  {
    id: "droits",
    icon: Scale,
    title: "Vos droits",
    body: (
      <p>
        Vous conservez le contrôle total sur vos données. Vous avez le droit de
        demander l’accès, la rectification, la portabilité ou la suppression
        complète de vos données de nos serveurs à tout moment. La suppression
        d’un compte entraîne la purge de toutes les données associées de notre
        base de données principale.
      </p>
    ),
  },
];

export default function PrivacyPolicy() {
  return (
    <LegalPage
      eyebrowIcon={ShieldCheck}
      title="Données et confidentialité"
      intro="Nous prenons la protection de vos données et de celles de vos clients très au sérieux. Voici, en toute transparence, comment nous les gérons."
      updatedLabel={LAST_UPDATED}
      updatedDate="2026-06-12"
      highlights={highlights}
      sections={sections}
      contactTitle="Une question sur vos données ?"
      contactText="Pour toute question sur cette politique ou pour exercer vos droits, notre équipe vous répond directement."
      whatsAppMessage="Bonjour, j'ai une question concernant la politique de confidentialité d'ExtravertyAI."
    />
  );
}
