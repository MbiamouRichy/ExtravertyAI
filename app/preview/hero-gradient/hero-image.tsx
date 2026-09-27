"use client";

import { useState } from "react";
import { ArrowUpRight, CheckCheck, ChevronRight, MessageCircle, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

const conversations = [
  { name: "Sarah M.", initials: "SM", subject: "Une nouvelle opportunité", preview: "Je cherche une solution pour mon équipe.", question: "Bonjour ! Je cherche une solution pour répondre aux clients de ma boutique. Vous pouvez m’aider ?", answer: "Bonjour Sarah ! Bien sûr. Combien de messages recevez-vous par jour sur WhatsApp ?", reply: "Une cinquantaine, et on n’arrive plus à suivre 😅", followup: "Je comprends ! Votre assistant peut accueillir chaque client et répondre aux questions fréquentes. Souhaitez-vous découvrir comment ?", need: "Automatiser les réponses clients", status: "Prospect qualifié" },
  { name: "Thomas D.", initials: "TD", subject: "Une réponse au bon moment", preview: "Est-ce que vous êtes ouverts samedi ?", question: "Bonjour, est-ce que votre boutique est ouverte samedi ?", answer: "Bonjour Thomas ! Oui, nous vous accueillons samedi de 9 h à 18 h. Vous recherchez un article en particulier ?", reply: "Oui, je voudrais voir votre nouvelle collection.", followup: "Avec plaisir ! Notre équipe pourra vous présenter les nouveautés lors de votre visite.", need: "Horaires et visite en boutique", status: "Question résolue" },
  { name: "Amina B.", initials: "AB", subject: "La bonne personne prend le relais", preview: "J’aimerais un devis personnalisé.", question: "Bonjour ! J’aimerais un devis pour équiper mes trois boutiques.", answer: "Bonjour Amina ! Je vais préparer votre demande. Combien de personnes utiliseront la solution ?", reply: "Nous sommes douze au total.", followup: "Merci ! Je transmets ces informations à l’équipe pour qu’elle puisse vous proposer un accompagnement adapté.", need: "Trois boutiques · Douze personnes", status: "Relais humain demandé" },
];

export function HeroImage() {
  const [selected, setSelected] = useState(0);
  const current = conversations[selected];

  return (
    <figure id="apercu" className="mx-auto mt-16 max-w-6xl scroll-mt-6 text-left sm:mt-20">
      <div className="rounded-2xl border bg-background/80 p-2 shadow-xl shadow-foreground/5">
        <div className="overflow-hidden rounded-xl border bg-background">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 sm:px-6">
            <div className="flex items-center gap-2 text-sm font-semibold"><MessageCircle aria-hidden="true" className="size-4" />Espace conversations</div>
            <span className="flex items-center gap-2 text-xs text-muted-foreground"><span className="size-1.5 rounded-full bg-foreground" />Assistant actif · Démo</span>
          </div>
          <div className="grid md:grid-cols-3 lg:grid-cols-4">
            <aside aria-label="Choisir une conversation fictive" className="border-b bg-muted/30 p-3 md:border-r md:border-b-0">
              <div className="mb-3 flex items-center justify-between px-2 text-xs text-muted-foreground"><span>CONVERSATIONS</span><span>03</span></div>
              <div className="flex gap-2 overflow-x-auto md:flex-col">
                {conversations.map((conversation, index) => (
                  <Button key={conversation.name} variant={selected === index ? "secondary" : "ghost"} aria-pressed={selected === index} aria-controls="conversation-preview" onClick={() => setSelected(index)} className="h-auto justify-start gap-3 px-3 py-4 text-left whitespace-normal md:w-full">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full border bg-background text-xs">{conversation.initials}</span>
                    <span className="min-w-0"><span className="block text-sm">{conversation.name}</span><span className="mt-1 hidden truncate text-xs font-normal text-muted-foreground md:block">{conversation.preview}</span></span>
                  </Button>
                ))}
              </div>
              <div className="mx-2 mt-24 hidden border-t pt-4 text-xs text-muted-foreground md:block"><Sparkles aria-hidden="true" className="mb-2 size-4" />L’IA répond.<br />Vous gardez le fil.</div>
            </aside>
            <section id="conversation-preview" aria-label={`Conversation avec ${current.name}`} aria-live="polite" className="min-w-0 md:col-span-2">
              <div className="flex items-center justify-between gap-2 border-b px-5 py-4"><div><div className="text-sm font-semibold">{current.name}</div><div className="mt-0.5 text-xs text-muted-foreground">{current.subject}</div></div><MessageCircle aria-hidden="true" className="size-4 text-muted-foreground" /></div>
              <div className="space-y-4 p-4 sm:p-6">
                <div className="text-center text-xs text-muted-foreground">Aujourd’hui · Conversation d’exemple</div>
                <div className="mr-8 rounded-2xl rounded-tl-sm border bg-muted/40 px-4 py-3 text-sm">{current.question}</div>
                <div className="ml-8 rounded-2xl rounded-tr-sm bg-primary px-4 py-3 text-sm text-primary-foreground"><span className="mb-1 flex items-center gap-1.5 text-xs opacity-80"><Sparkles aria-hidden="true" className="size-3" />Votre assistant</span>{current.answer}<CheckCheck aria-label="Lu" className="mt-2 ml-auto size-3" /></div>
                <div className="mr-8 rounded-2xl rounded-tl-sm border bg-muted/40 px-4 py-3 text-sm">{current.reply}</div>
                <div className="ml-8 rounded-2xl rounded-tr-sm bg-primary px-4 py-3 text-sm text-primary-foreground">{current.followup}<CheckCheck aria-label="Lu" className="mt-2 ml-auto size-3" /></div>
              </div>
              <div className="mx-4 mb-4 flex items-center gap-2 rounded-lg border border-dashed px-4 py-3 text-xs text-muted-foreground"><Sparkles aria-hidden="true" className="size-4 shrink-0" />Réponse automatique adaptée à votre activité</div>
            </section>
            <aside aria-label="Résumé du contact" className="hidden border-l bg-muted/20 p-5 lg:block">
              <Users aria-hidden="true" className="mb-4 size-5" /><div className="text-sm font-semibold">Un contact, du contexte.</div>
              <p className="mt-2 text-xs text-muted-foreground">L’essentiel pour poursuivre la conversation.</p>
              <dl className="mt-7 space-y-6 text-xs"><div><dt className="text-muted-foreground">Contact</dt><dd className="mt-1 font-medium">{current.name}</dd></div><div><dt className="text-muted-foreground">Besoin identifié</dt><dd className="mt-1 leading-relaxed">{current.need}</dd></div><div><dt className="text-muted-foreground">Statut</dt><dd className="mt-2 inline-flex items-center gap-1 rounded-md border bg-background px-2 py-1"><ArrowUpRight aria-hidden="true" className="size-3" />{current.status}</dd></div></dl>
              <div className="mt-8 flex items-center gap-1 border-t pt-4 text-xs text-muted-foreground">Prêt pour la suite<ChevronRight aria-hidden="true" className="size-3" /></div>
            </aside>
          </div>
        </div>
      </div>
      <figcaption className="mt-4 text-center text-xs text-muted-foreground">Du premier message à la prochaine opportunité. Sélectionnez un contact pour explorer la démo.</figcaption>
    </figure>
  );
}
