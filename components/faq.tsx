import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { DecorIcon } from "./ui/decor-icon";
import { FullWidthDivider } from "./ui/full-width-divider";
import { AutomatiserButton } from "./hero";

const items = [
  {
    value: "lost-sales",
    trigger: "Je perds déjà des clients parce que je réponds trop lentement…",
    content:
      "C’est exactement là qu’Extraverty intervient. L’IA répond instantanément à vos clients sur WhatsApp, même quand vous dormez ou travaillez. Chaque message non répondu est une vente perdue — ce système règle ce problème automatiquement.",
  },
  {
    value: "money-question",
    trigger: "Est-ce que ça va vraiment me faire gagner de l’argent ?",
    content:
      "Oui. L’objectif n’est pas seulement de répondre aux messages, mais de transformer chaque conversation en opportunité de vente. Plus de réponses rapides = plus de clients qui achètent.",
  },
  {
    value: "no-time",
    trigger: "Je n’ai pas le temps de gérer ça…",
    content:
      "Justement. Extraverty est conçu pour fonctionner sans vous. Une fois installé, il gère vos clients 24h/24 pendant que vous vous concentrez sur votre business.",
  },
  {
    value: "works-really",
    trigger: "Est-ce que ça marche vraiment ou c’est juste un bot basique ?",
    content:
      "Ce n’est pas un simple bot automatique. C’est une IA qui comprend les messages, les intentions des clients et répond comme un vrai assistant commercial.",
  },
  {
    value: "whatsapp-ban",
    trigger: "Est-ce que je risque un blocage WhatsApp ?",
    content:
      "Non, le système est conçu pour fonctionner avec les APIs officielles ou des solutions sécurisées. Les bonnes pratiques sont respectées pour éviter les blocages.",
  },
  {
    value: "setup",
    trigger: "C’est compliqué à installer ?",
    content:
      "Non. Tout est configuré pour vous. Vous recevez un système prêt à utiliser, sans compétences techniques nécessaires.",
  },
  {
    value: "competitors",
    trigger: "Pourquoi je ne devrais pas juste répondre moi-même ?",
    content:
      "Parce que vos concurrents qui répondent plus vite récupèrent vos clients. La vitesse de réponse est aujourd’hui un avantage compétitif majeur.",
  },
  {
    value: "proof",
    trigger: "Est-ce que je peux voir une démonstration ?",
    content:
      "Oui. Vous pouvez tester une démo en temps réel sur WhatsApp pour voir exactement comment l’IA répond à vos clients avant de commencer.",
  },
  {
    value: "price-objection",
    trigger: "C’est trop cher pour moi…",
    content:
      "Le vrai coût, ce n’est pas l’outil — c’est les clients que vous perdez chaque jour sans réponse rapide. Un seul client récupéré peut couvrir le coût du service.",
  },
  {
    value: "support",
    trigger: "Et si j’ai un problème ?",
    content:
      "Vous avez un support pour l’installation et l’utilisation. Le système est aussi conçu pour être stable et autonome.",
  },
];
export function Faq() {
  return (
    <div
      id="faq"
      className="relative w-full flex flex-col items-center justify-center gap-6 md:gap-10 py-10"
    >
      <DecorIcon className="size-4" position="top-left" />
      <DecorIcon className="size-4" position="top-right" />
      <DecorIcon className="size-4" position="bottom-left" />
      <DecorIcon className="size-4" position="bottom-right" />
      <FullWidthDivider className="-top-px" />
      <div className="flex flex-col justify-center items-center gap-2 text-center">
        <h5 className="text-center font-bold text-2xl tracking-tight md:text-3xl lg:font-extrabold lg:text-4xl">
          Questions Fréquemment Posées
        </h5>
        <p className="text-sm text-muted-foreground">
          Voici les questions les plus souvent demandées par nos clients :
        </p>
      </div>
      <div className="w-full flex flex-col items-center justify-center gap-6 md:gap-10">
        <Accordion
          type="single"
          collapsible
          className="max-w-xl px-2"
          defaultValue="lost-sales"
        >
          {items.map((item) => (
            <AccordionItem key={item.value} value={item.value}>
              <AccordionTrigger className="text-base">
                {item.trigger}
              </AccordionTrigger>
              <AccordionContent>{item.content}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
        <FullWidthDivider className="-bottom-px" />
      </div>
      <div className="max-w-xl px-2 md:px-6 text-center flex flex-col items-center gap-2 justify-center py-4">
        <p className="text-base font-medium">
          Avez-vous des questions ou toutes autres demandes supplémentaires ?
        </p>

        <p className="text-muted-foreground text-sm mb-4">
          Pour toute question, n&apos;hésitez pas à nous contacter via WhatsApp.
          Nous sommes là pour vous aider à réussir avec ExtravertyAI.
        </p>
        <AutomatiserButton
          href="https://wa.me/24176205629?text=Bonjour,%20je%20veux%20automatiser%20mes%20ventes%20sur%20WhatsApp%20mes%20j'ai%20quelques%20questions.%20Pouvez-vous%20m'accompagner%20?[FAQ]"
          text="Discuter via WhatsApp"
          className="w-full md:w-fit mt-1"
          target="_blank"
        />
      </div>
      <FullWidthDivider className="-bottom-px" />
    </div>
  );
}
