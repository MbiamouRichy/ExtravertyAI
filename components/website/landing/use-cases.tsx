import { Building2, ShoppingBag, Stethoscope, UtensilsCrossed } from "lucide-react";

import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const cases = [
  {
    id: "ecommerce",
    label: "E-commerce",
    icon: ShoppingBag,
    title: "Vendez pendant que vous dormez",
    points: [
      "Disponibilités, tailles et prix répondus instantanément",
      "Relance automatique des paniers laissés en suspens",
      "Lien de paiement envoyé au bon moment",
    ],
    thread: [
      { from: "client", text: "Vous livrez à Yaoundé ce week-end ?" },
      { from: "ai", text: "Oui ! Livraison samedi entre 10 h et 14 h. Je confirme votre commande de 2 articles ?" },
    ],
  },
  {
    id: "immobilier",
    label: "Immobilier",
    icon: Building2,
    title: "Qualifiez chaque demande de visite",
    points: [
      "Budget, quartier et délai collectés en conversation",
      "Score de qualification visible par votre équipe",
      "Transfert à un agent humain pour les prospects chauds",
    ],
    thread: [
      { from: "client", text: "L’appartement à Bonapriso est toujours dispo ?" },
      { from: "ai", text: "Oui. Pour organiser une visite : quel est votre budget mensuel et votre date d’emménagement ?" },
    ],
  },
  {
    id: "restauration",
    label: "Restauration",
    icon: UtensilsCrossed,
    title: "Commandes et réservations sans attente",
    points: [
      "Menu du jour partagé à la demande",
      "Prise de réservation avec nombre de couverts",
      "Notes vocales comprises et retranscrites",
    ],
    thread: [
      { from: "client", text: "🎤 Note vocale · 0:09" },
      { from: "ai", text: "C’est noté : table pour 4 ce soir à 20 h au nom de Paul. À tout à l’heure !" },
    ],
  },
  {
    id: "services",
    label: "Services",
    icon: Stethoscope,
    title: "Un secrétariat ouvert 24 h/24",
    points: [
      "Questions fréquentes traitées sans intervention",
      "Créneaux proposés selon vos consignes",
      "Résumé IA avant chaque rappel client",
    ],
    thread: [
      { from: "client", text: "Vous êtes ouverts le samedi ?" },
      { from: "ai", text: "Oui, de 9 h à 13 h. Souhaitez-vous que je transmette une demande de rendez-vous ?" },
    ],
  },
] as const;

export function UseCases() {
  return (
    <Tabs defaultValue="ecommerce" className="gap-8">
      <TabsList className="mx-auto h-auto flex-wrap justify-center">
        {cases.map(({ id, label, icon: Icon }) => (
          <TabsTrigger key={id} value={id} className="gap-1.5 px-3 py-1.5">
            <Icon aria-hidden="true" />
            {label}
          </TabsTrigger>
        ))}
      </TabsList>
      {cases.map((item) => (
        <TabsContent
          key={item.id}
          value={item.id}
          className="grid items-center gap-8 rounded-2xl border bg-card p-6 sm:p-10 md:grid-cols-2 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300"
        >
          <div className="space-y-5">
            <h3 className="text-2xl">{item.title}</h3>
            <ul className="space-y-3">
              {item.points.map((point) => (
                <li key={point} className="flex gap-3 text-sm text-muted-foreground">
                  <span
                    aria-hidden="true"
                    className="mt-2 size-1.5 shrink-0 rounded-full bg-foreground"
                  />
                  {point}
                </li>
              ))}
            </ul>
          </div>
          <div
            aria-label="Exemple de conversation"
            className="flex flex-col gap-2.5 rounded-xl border bg-muted/40 p-5"
          >
            {item.thread.map((message, index) => (
              <p
                key={index}
                className={cn(
                  "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm",
                  message.from === "client"
                    ? "self-start rounded-bl-sm border bg-background"
                    : "self-end rounded-br-sm bg-primary text-primary-foreground",
                )}
              >
                <span className="sr-only">
                  {message.from === "client" ? "Client : " : "Assistant IA : "}
                </span>
                {message.text}
              </p>
            ))}
          </div>
        </TabsContent>
      ))}
    </Tabs>
  );
}
