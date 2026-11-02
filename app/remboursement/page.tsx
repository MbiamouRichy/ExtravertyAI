import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarClock,
  CircleCheck,
  CircleSlash,
  CircleX,
  Clock,
  Receipt,
  RefreshCw,
  Send,
} from "lucide-react";

import { LegalPage, type LegalSection } from "@/components/website/legal-page";

export const metadata: Metadata = {
  title: "Politique de remboursement | ExtravertyAI",
  description:
    "Essai gratuit, résiliation et cas de remboursement des abonnements ExtravertyAI.",
  alternates: { canonical: "/remboursement" },
};
export const dynamic = "force-static";

const highlights = [
  { icon: CalendarClock, title: "Essai gratuit", text: "Aucun prélèvement si vous annulez avant la fin." },
  { icon: RefreshCw, title: "Résiliation libre", text: "Accès conservé jusqu’à la fin de la période." },
  { icon: Clock, title: "14 jours pour demander", text: "Pour un double débit ou une erreur de facturation." },
];

const sections: LegalSection[] = [
  {
    id: "essai",
    icon: CalendarClock,
    title: "Pendant l’essai",
    body: (
      <p>
        L’essai de 10 jours est gratuit. Si vous annulez avant sa fin, vous
        n’êtes pas débité. Sans annulation, le premier mois est prélevé à la fin
        de l’essai.
      </p>
    ),
  },
  {
    id: "resiliation",
    icon: CircleSlash,
    title: "Résilier votre abonnement",
    body: (
      <p>
        Vous pouvez résilier à tout moment depuis votre espace de facturation.
        Aucun renouvellement n’est prélevé ensuite, et vous gardez l’accès
        jusqu’à la fin de la période déjà payée. Résiliez avant la date de
        renouvellement pour éviter le prélèvement suivant.
      </p>
    ),
  },
  {
    id: "rembourses",
    icon: CircleCheck,
    title: "Cas remboursés",
    body: (
      <>
        <p>Nous remboursons le montant concerné en cas de :</p>
        <ul>
          <li>double prélèvement ou erreur de montant ;</li>
          <li>prélèvement effectué après une résiliation enregistrée ;</li>
          <li>
            panne majeure de notre fait, empêchant durablement le service de
            fonctionner et que nous n’avons pas pu corriger.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "non-rembourses",
    icon: CircleX,
    title: "Cas non remboursés",
    body: (
      <ul>
        <li>les périodes déjà commencées, sauf dans les cas ci-dessus ;</li>
        <li>les messages ou fonctionnalités non utilisés ;</li>
        <li>l’oubli d’annuler avant la fin de l’essai ou le renouvellement ;</li>
        <li>
          une suspension liée au non-respect de nos{" "}
          <Link href="/conditions">conditions d’utilisation</Link> ;
        </li>
        <li>
          la restriction d’un numéro par WhatsApp ou une panne d’un service tiers
          hors de notre contrôle.
        </li>
      </ul>
    ),
  },
  {
    id: "demande",
    icon: Send,
    title: "Faire une demande",
    body: (
      <p>
        Contactez-nous sous 14 jours après le prélèvement, avec l’e-mail du
        compte, le nom du projet et la date du paiement. Nous répondons sous 5
        jours ouvrés. Merci de nous écrire avant d’ouvrir une contestation auprès
        de votre banque : c’est souvent la solution la plus rapide.
      </p>
    ),
  },
  {
    id: "versement",
    icon: Receipt,
    title: "Versement du remboursement",
    body: (
      <p>
        Le remboursement est effectué sur le moyen de paiement d’origine, dans la
        devise payée. Son arrivée sur votre compte dépend de votre banque ou de
        notre prestataire de paiement. Cette politique ne limite pas les droits
        que la loi vous accorde.
      </p>
    ),
  },
];

export default function RefundPage() {
  return (
    <LegalPage
      eyebrowIcon={Receipt}
      title="Politique de remboursement"
      intro="Ce qui se passe si vous annulez, et dans quels cas nous vous remboursons."
      updatedLabel="2 novembre 2026"
      updatedDate="2026-11-02"
      highlights={highlights}
      sections={sections}
      contactTitle="Besoin d’un remboursement ?"
      contactText="Écrivez-nous avec la date du paiement : notre équipe vérifie votre demande."
      whatsAppMessage="Bonjour, je souhaite faire une demande concernant un remboursement ExtravertyAI."
    />
  );
}
