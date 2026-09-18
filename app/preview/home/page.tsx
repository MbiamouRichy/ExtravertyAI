import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  Bot,
  CheckCheck,
  ChevronRight,
  Command,
  CornerDownRight,
  Inbox,
  MessageCircle,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Users,
  Workflow,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";

export const metadata: Metadata = {
  title: "Proposition d’accueil | ExtravertyAI",
  robots: { index: false, follow: false },
};

export default function HomePreview() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div
      className="min-h-screen bg-background text-foreground selection:bg-primary selection:text-primary-foreground [&_p]:[font-family:inherit]"
      style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
    >
      <div className="border-b bg-muted/40 px-5 py-2 text-center text-xs text-muted-foreground">
        PROPOSITION 01 <span className="mx-2">/</span> Aperçu de design · Votre
        accueil actuel reste inchangé
      </div>
      <header className="mx-auto flex h-20 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
        <Link
          href="/"
          aria-label="Accueil actuel ExtravertyAI"
          className="flex items-center gap-2.5 text-lg font-semibold tracking-tight"
        >
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Command className="size-5" />
          </span>
          Extraverty<span className="-ml-2 text-muted-foreground">AI</span>
        </Link>
        <nav
          aria-label="Navigation de la maquette"
          className="hidden items-center gap-6 text-sm text-muted-foreground md:flex"
        >
          <Link href="#produit" className="hover:text-foreground">
            Le produit
          </Link>
          <Link href="#fonctionnement" className="hover:text-foreground">
            Comment ça marche
          </Link>
          <Link href="/contact" className="hover:text-foreground">
            Contact
          </Link>
        </nav>
        <Button asChild variant="outline" size="sm">
          <Link href="/sign-in">
            Se connecter
            <ArrowUpRight className="size-3.5" />
          </Link>
        </Button>
      </header>
      <main>
        <section className="mx-auto max-w-6xl px-5 pb-14 pt-14 sm:px-8 sm:pt-20">
          <div className="grid gap-8 lg:grid-cols-[1.4fr_0.7fr] lg:items-end lg:gap-20">
            <div>
              <Badge
                variant="outline"
                className="mb-7 rounded-full px-3 py-1.5 font-normal"
              >
                <span className="mr-2 size-1.5 rounded-full bg-foreground" />
                Votre relation client, augmentée par l’IA
              </Badge>
              <h1 className="max-w-3xl text-4xl! font-medium! leading-[1.02]! tracking-[-0.055em]! sm:text-7xl!">
                Moins de répétitions.
                <br />
                <span className="text-muted-foreground">
                  Plus de conversations.
                </span>
              </h1>
            </div>
            <div className="max-w-sm pb-1">
              <p className="text-base leading-relaxed text-muted-foreground">
                Un assistant IA pour accueillir vos prospects sur WhatsApp. Un
                espace partagé pour reprendre la main quand cela compte.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link href="/sign-up">
                    Créer mon espace
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="ghost">
                  <Link href="#produit">
                    Explorer le produit
                    <ChevronRight className="size-4" />
                  </Link>
                </Button>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Votre ton. Vos consignes. Votre équipe.
              </p>
            </div>
          </div>
          <div className="mt-14 flex items-center justify-between border-t pt-5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            <span>01 / L’espace de conversation</span>
            <span>Illustration du produit</span>
          </div>
          <Card
            id="produit"
            className="mt-4 scroll-mt-8 gap-0 overflow-hidden rounded-2xl border py-0 shadow-[0_24px_70px_-35px_rgba(0,0,0,0.25)] ring-0"
          >
            <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full border bg-background" />
                <span className="size-2 rounded-full border bg-background" />
                <span className="size-2 rounded-full border bg-background" />
              </div>
              <span className="font-mono text-[10px] text-muted-foreground">
                workspace / conversations
              </span>
              <Badge variant="outline" className="text-[10px]">
                Données de démonstration
              </Badge>
            </div>
            <div className="grid min-h-96 grid-cols-1 md:grid-cols-[64px_240px_1fr]">
              <aside
                aria-label="Illustration des outils"
                className="hidden flex-col items-center gap-7 border-r bg-muted/20 py-6 md:flex"
              >
                <Command className="size-5" />
                <Separator className="w-7!" />
                <Inbox className="size-5" />
                <Users className="size-5 text-muted-foreground" />
                <Bot className="size-5 text-muted-foreground" />
                <Settings2 className="mt-auto size-5 text-muted-foreground" />
              </aside>
              <div className="hidden border-r md:block">
                <div className="flex items-center justify-between p-5 text-sm font-semibold">
                  Conversations
                  <Search className="size-4 text-muted-foreground" />
                </div>
                <div className="mx-3 flex gap-2 rounded-md bg-muted px-3 py-2 text-xs">
                  <Inbox className="size-3.5" />
                  Toutes les conversations
                </div>
                {[
                  {
                    name: "Camille",
                    text: "Parfait, merci beaucoup !",
                    active: true,
                  },
                  {
                    name: "Alex",
                    text: "Quels sont vos horaires ?",
                    active: false,
                  },
                  {
                    name: "Sarah",
                    text: "Je souhaite en savoir plus.",
                    active: false,
                  },
                ].map((c) => (
                  <div
                    key={c.name}
                    className={`mx-3 mt-3 rounded-lg border p-3 ${c.active ? "bg-muted/60" : "border-transparent"}`}
                  >
                    <div className="flex items-center gap-2">
                      <Avatar className="size-7">
                        <AvatarFallback className="text-[10px]">
                          {c.name[0]}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs font-medium">{c.name}</span>
                      <span className="ml-auto text-[9px] text-muted-foreground">
                        12:04
                      </span>
                    </div>
                    <p className="mt-2 truncate text-[11px] text-muted-foreground">
                      {c.text}
                    </p>
                  </div>
                ))}
              </div>
              <div className="flex flex-col">
                <div className="flex items-center justify-between gap-2 border-b p-4 sm:px-6">
                  <div className="flex items-center gap-3">
                    <Avatar className="size-8">
                      <AvatarFallback>C</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-xs font-semibold">Camille</p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        Conversation WhatsApp
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="gap-1.5 font-normal">
                    <Sparkles className="size-3" />
                    Assistant actif
                  </Badge>
                </div>
                <div className="flex-1 space-y-5 p-5 sm:p-8">
                  <p className="text-center text-[10px] text-muted-foreground">
                    EXEMPLE DE CONVERSATION
                  </p>
                  <div className="max-w-[85%] rounded-xl rounded-tl-sm border px-4 py-3 text-xs leading-relaxed sm:max-w-[70%]">
                    Bonjour ! Est-ce que je peux prendre rendez-vous pour
                    découvrir vos services ?
                  </div>
                  <div className="ml-auto max-w-[90%] rounded-xl rounded-tr-sm bg-primary px-4 py-3 text-xs leading-relaxed text-primary-foreground sm:max-w-[75%]">
                    <p className="mb-2 flex items-center gap-1.5 text-[10px] text-primary-foreground/60">
                      <Sparkles className="size-3" />
                      Votre assistant
                    </p>
                    Bonjour Camille ! Avec plaisir. Quel service vous intéresse
                    ? Je pourrai transmettre votre demande à notre équipe.
                    <CheckCheck className="ml-auto mt-2 size-3.5 opacity-60" />
                  </div>
                  <div className="max-w-[70%] rounded-xl rounded-tl-sm border px-4 py-3 text-xs">
                    Parfait, merci beaucoup !
                  </div>
                </div>
                <div className="mx-5 mb-5 flex items-center gap-2 rounded-lg border border-dashed bg-muted/20 p-3 text-xs text-muted-foreground">
                  <CornerDownRight className="size-4" />
                  Votre équipe peut prendre le relais à tout moment.
                </div>
              </div>
            </div>
          </Card>
          <div className="mt-6 flex flex-wrap justify-center gap-x-9 gap-y-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-2">
              <MessageCircle className="size-3.5" />
              Conversations centralisées
            </span>
            <span className="flex items-center gap-2">
              <Settings2 className="size-3.5" />
              Réponses personnalisables
            </span>
            <span className="flex items-center gap-2">
              <Users className="size-3.5" />
              Relais humain
            </span>
          </div>
        </section>
        <section id="fonctionnement" className="border-y bg-muted/20">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
            <div className="mb-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <h2 className="max-w-lg text-3xl font-medium tracking-tight sm:text-4xl">
                Simple à configurer.
                <br />
                <span className="text-muted-foreground">
                  Précis dans son rôle.
                </span>
              </h2>
              <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
                Vous définissez ce que votre assistant doit savoir et quand
                votre équipe intervient.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                {
                  icon: MessageCircle,
                  n: "01",
                  title: "Connectez WhatsApp",
                  text: "Reliez le compte de votre activité à un espace de travail dédié.",
                },
                {
                  icon: Workflow,
                  n: "02",
                  title: "Donnez-lui votre méthode",
                  text: "Ajoutez vos informations, votre ton et les consignes de réponse de l’assistant.",
                },
                {
                  icon: ShieldCheck,
                  n: "03",
                  title: "Gardez la main",
                  text: "Suivez les échanges et reprenez les conversations qui demandent votre attention.",
                },
              ].map(({ icon: Icon, ...item }) => (
                <Card key={item.n} className="gap-4 rounded-xl shadow-none">
                  <CardHeader>
                    <div className="mb-7 flex items-center justify-between">
                      <Icon className="size-5" />
                      <span className="font-mono text-xs text-muted-foreground">
                        {item.n}
                      </span>
                    </div>
                    <CardTitle className="text-base font-medium">
                      {item.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm leading-relaxed text-muted-foreground">
                    {item.text}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
        <section className="mx-auto flex max-w-6xl flex-col justify-between gap-8 px-5 py-16 sm:flex-row sm:items-center sm:px-8">
          <div>
            <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Pensé pour votre quotidien
            </p>
            <h2 className="text-3xl font-medium tracking-tight">
              Votre prochaine conversation
              <br />
              mérite une bonne réponse.
            </h2>
          </div>
          <Button asChild size="lg" className="w-fit">
            <Link href="/contact">
              Parlons de votre activité
              <ArrowUpRight className="size-4" />
            </Link>
          </Button>
        </section>
      </main>
      <footer className="mx-auto flex max-w-6xl flex-wrap justify-between gap-4 border-t px-5 py-6 text-xs text-muted-foreground sm:px-8">
        <span>ExtravertyAI · L’IA au service de la conversation.</span>
        <div className="flex gap-5">
          <Link href="/">Accueil actuel</Link>
          <Link href="/donneesEtConfidentialite">Confidentialité</Link>
        </div>
      </footer>
    </div>
  );
}
