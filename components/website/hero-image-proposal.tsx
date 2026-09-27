import Link from "next/link";
import {
  ArrowRight,
  Bot,
  CheckCheck,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  UserRound,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const scenarios = [
  {
    id: "accueillir",
    label: "Accueillir",
    tag: "Une première réponse, même après vos horaires",
    question: "Bonsoir ! Vous êtes ouverts demain ?",
    answer:
      "Bonsoir ! Oui, notre boutique vous accueille de 9 h à 18 h. Que recherchez-vous ?",
    reply: "Un cadeau pour un anniversaire.",
    next: "Avec plaisir. Quel budget souhaitez-vous y consacrer ?",
    note: "L’agent s’appuie sur les informations de votre entreprise.",
  },
  {
    id: "qualifier",
    label: "Qualifier",
    tag: "Une question à la fois pour comprendre le besoin",
    question: "Bonjour, je voudrais un devis pour mon équipe.",
    answer:
      "Bonjour ! Je peux vous aider à préciser votre demande. Combien de personnes sont concernées ?",
    reply: "Nous sommes 12, pour le mois prochain.",
    next: "Merci ! Quelle prestation vous intéresse ?",
    note: "Votre équipe retrouve les besoins exprimés dans la conversation.",
  },
  {
    id: "orienter",
    label: "Orienter",
    tag: "Le bon relais quand une réponse demande un humain",
    question: "J’ai une demande particulière pour ma commande.",
    answer: "Bien sûr. Pouvez-vous me préciser votre demande ?",
    reply: "Je souhaite une personnalisation sur mesure.",
    next: "Un conseiller pourra vérifier les possibilités avec vous. Souhaitez-vous poursuivre avec notre équipe ?",
    note: "L’agent propose un conseiller lorsqu’il ne peut pas répondre seul.",
  },
];

const benefits = [
  {
    icon: Zap,
    title: "Présent dès le premier message",
    description:
      "Accueillez vos prospects, même lorsque votre équipe est occupée.",
  },
  {
    icon: MessageCircle,
    title: "Des échanges qui avancent",
    description: "Précisez chaque besoin avec des questions simples et utiles.",
  },
  {
    icon: ShieldCheck,
    title: "Votre équipe garde la main",
    description:
      "Retrouvez les échanges et reprenez la conversation au bon moment.",
  },
];

/** Standalone design proposal. Not mounted on the existing home page. */
export default function HeroImageProposal() {
  return (
    <section
      aria-labelledby="proposal-title"
      className="mx-auto max-w-6xl px-4 py-16 sm:px-8 lg:py-24"
    >
      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div className="space-y-7">
          <Badge variant="outline" className="gap-2 px-3 py-1 h-auto">
            <Sparkles aria-hidden="true" /> Votre agent IA, votre façon de
            répondre
          </Badge>
          <h2
            id="proposal-title"
            className="text-balance text-4xl! font-semibold tracking-tight sm:text-5xl!"
          >
            Chaque message
            <br className="hidden sm:block" /> mérite une réponse.
          </h2>
          <p className="max-w-md text-pretty text-base leading-7 text-muted-foreground">
            Faites de WhatsApp le début d’une vraie relation. ExtravertyAI
            accueille vos prospects, comprend leur besoin et prépare la suite
            avec votre équipe.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button asChild size="lg">
              <Link href="/sign-up">
                Créer mon agent <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="ghost" size="lg">
              <Link href="/#demo">
                Découvrir le fonctionnement <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </div>
          <p className="flex items-center gap-2 text-xs leading-5 text-muted-foreground">
            <ShieldCheck className="size-4 shrink-0" aria-hidden="true" /> Votre
            ton. Vos informations. Vos règles.
          </p>
        </div>

        <div className="min-w-0 space-y-4">
          <Tabs defaultValue="accueillir" className="gap-4">
            <TabsList aria-label="Exemples de conversations" className="w-full">
              {scenarios.map(({ id, label }) => (
                <TabsTrigger key={id} value={id} className="flex-1">
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
            {scenarios.map((scenario) => (
              <TabsContent key={scenario.id} value={scenario.id}>
                <Card className="gap-0 overflow-hidden shadow-lg shadow-foreground/5">
                  <CardHeader className="flex flex-row items-center justify-between gap-3 border-b pb-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="size-10">
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          <Bot className="size-5" aria-hidden="true" />
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">Votre entreprise</p>
                        <p className="text-xs text-muted-foreground">
                          Assistant IA · WhatsApp
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary">Exemple</Badge>
                  </CardHeader>
                  <CardContent className="space-y-4 bg-muted/20 py-6">
                    <p className="text-center text-xs text-muted-foreground">
                      Conversation illustrative
                    </p>
                    <Item variant="outline" className="mr-8 w-auto bg-card">
                      <ItemContent>
                        <ItemDescription className="line-clamp-none text-card-foreground">
                          {scenario.question}
                        </ItemDescription>
                        <span className="text-xs text-muted-foreground">
                          Prospect · 19:42
                        </span>
                      </ItemContent>
                    </Item>
                    <Item className="ml-8 w-auto bg-primary text-primary-foreground">
                      <ItemContent>
                        <ItemDescription className="line-clamp-none text-primary-foreground">
                          {scenario.answer}
                        </ItemDescription>
                        <span className="flex items-center justify-end gap-1 text-xs text-primary-foreground/80">
                          19:42{" "}
                          <CheckCheck className="size-3.5" aria-label="Lu" />
                        </span>
                      </ItemContent>
                    </Item>
                    <Item variant="outline" className="mr-8 w-auto bg-card">
                      <ItemContent>
                        <ItemDescription className="line-clamp-none text-card-foreground">
                          {scenario.reply}
                        </ItemDescription>
                      </ItemContent>
                    </Item>
                    <Item className="ml-8 w-auto bg-primary text-primary-foreground">
                      <ItemContent>
                        <ItemDescription className="line-clamp-none text-primary-foreground">
                          {scenario.next}
                        </ItemDescription>
                        <span className="flex items-center justify-end gap-1 text-xs text-primary-foreground/80">
                          19:43{" "}
                          <CheckCheck className="size-3.5" aria-label="Lu" />
                        </span>
                      </ItemContent>
                    </Item>
                  </CardContent>
                  <CardFooter className="gap-2 text-xs leading-5 text-muted-foreground">
                    <UserRound className="size-4 shrink-0" aria-hidden="true" />
                    {scenario.note}
                  </CardFooter>
                </Card>
                <p className="mt-4 text-center text-xs leading-5 text-muted-foreground">
                  {scenario.tag}
                </p>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </div>
      <div className="mt-14 grid gap-6 border-t pt-8 md:grid-cols-3 lg:mt-20">
        {benefits.map(({ icon: Icon, title, description }) => (
          <Item key={title} className="items-start p-0">
            <ItemMedia variant="icon" className="rounded-lg bg-muted p-2.5">
              <Icon className="size-5" aria-hidden="true" />
            </ItemMedia>
            <ItemContent>
              <ItemTitle className="line-clamp-none">{title}</ItemTitle>
              <ItemDescription className="line-clamp-none leading-6">
                {description}
              </ItemDescription>
            </ItemContent>
          </Item>
        ))}
      </div>
    </section>
  );
}
