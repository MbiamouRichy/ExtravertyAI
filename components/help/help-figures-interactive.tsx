"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Copy,
  Laptop,
  MessageCircle,
  Power,
  QrCode,
  RotateCcw,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

import { Button } from "@/components/ui/button";
import { formatPlanPrice, PRICING_PLANS, TRIAL_DAYS, TRIAL_MESSAGES } from "@/lib/pricing";
import { cn } from "@/lib/utils";

import { MockButton, MockHeading, MockStepper, MockWaiting, MockWindow } from "./help-mockups";

/** QR code d’illustration : il ne mène nulle part et le dit si on le scanne. */
function SampleQr() {
  return (
    <div className="mx-auto w-fit rounded-xl border bg-background p-3 sm:mx-0" aria-hidden="true">
      <QRCodeSVG
        value="ExtravertyAI : QR code d’exemple du centre d’aide"
        size={136}
        bgColor="var(--background)"
        fgColor="var(--foreground)"
        level="L"
      />
    </div>
  );
}

function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; icon?: React.ReactNode }[];
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex gap-1 rounded-lg border bg-muted/60 p-1">
      {options.map((option) => (
        <Button
          key={option.value}
          type="button"
          size="xs"
          variant={value === option.value ? "outline" : "ghost"}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(value !== option.value && "text-muted-foreground")}
        >
          {option.icon}
          {option.label}
        </Button>
      ))}
    </div>
  );
}

const HIGHLIGHTED = PRICING_PLANS.find((plan) => plan.highlighted) ?? PRICING_PLANS[0];

export function VerificationFigure() {
  const [state, setState] = useState<"wait" | "done">("wait");
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">Aperçu de l’écran</span>
        <Segmented
          label="État de l’écran de vérification"
          value={state}
          onChange={setState}
          options={[
            { value: "wait", label: "En attente" },
            { value: "done", label: "Vérifié" },
          ]}
        />
      </div>
      <MockWindow url="extravertyai.com/projects/new">
        <div aria-hidden="true">
          {state === "wait" ? (
            <>
              <MockHeading title="Vérifiez votre numéro" />
              <p className="mt-1 text-xs">
                <span className="font-medium">+241 74 12 34 56</span>{" "}
                <span className="text-muted-foreground underline underline-offset-2">Modifier</span>
              </p>
              <div className="mt-5 grid gap-3">
                <div className="flex flex-col items-start gap-3 rounded-xl border bg-muted/40 p-3 sm:flex-row sm:items-center sm:gap-4">
                  <SampleQr />
                  <div className="grid w-full min-w-0 flex-1 gap-2">
                    <p className="text-xs text-muted-foreground">Scannez avec le téléphone de ce numéro, puis envoyez le message.</p>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xl font-semibold tracking-[0.2em]">
                        482<span className="inline-block w-2" />913
                      </span>
                      <MockButton variant="outline">
                        <Copy />
                        Copier
                      </MockButton>
                    </div>
                  </div>
                </div>
                <MockButton variant="outline" className="h-9 w-full">
                  <MessageCircle />
                  Ouvrir WhatsApp sur cet ordinateur
                </MockButton>
                <MockWaiting>En attente du message…</MockWaiting>
                <p className="text-[11px] text-muted-foreground underline underline-offset-2">Recevoir un code à la place</p>
              </div>
            </>
          ) : (
            <>
              <MockHeading title="Numéro vérifié" />
              <div className="mt-3 flex items-center gap-3 rounded-xl border bg-muted/40 p-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
                  <ShieldCheck className="size-5" />
                </span>
                <span>
                  <span className="block text-sm font-medium">+241 74 12 34 56</span>
                  <span className="block text-xs text-muted-foreground">Confirmé avec WhatsApp</span>
                </span>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Essai gratuit de {TRIAL_DAYS} jours ou {TRIAL_MESSAGES} messages, puis forfait {HIGHLIGHTED.name} à{" "}
                {formatPlanPrice(HIGHLIGHTED.priceCents)} par mois.
              </p>
              <MockButton className="mt-4 h-9 w-full">Continuer vers le paiement</MockButton>
            </>
          )}
        </div>
      </MockWindow>
      <p className="sr-only" aria-live="polite">
        {state === "wait" ? "Aperçu : en attente du message de vérification." : "Aperçu : numéro vérifié."}
      </p>
    </div>
  );
}

const DEMO = [
  {
    question: "Quels sont vos horaires ?",
    answer: "Nous sommes ouverts du lundi au samedi, de 9 h à 19 h. Vous pouvez m’écrire ici à toute heure, je vous réponds.",
  },
  {
    question: "Vous livrez à Port-Gentil ?",
    answer: "Oui, nous livrons à Port-Gentil sous 48 h, pour 3 000 FCFA. Quel article vous intéresse ?",
  },
  {
    question: "Vous faites des remises ?",
    answer:
      "Je n’ai pas d’information sur des remises en ce moment, je préfère ne rien vous promettre. Pour en parler, vous pouvez contacter un conseiller de la boutique.",
  },
];

type DemoMessage = { from: "client" | "bot"; text: string };
const GREETING: DemoMessage = {
  from: "bot",
  text: "Bonjour ! Je suis Nova, l’assistante de Boutique Akanda. Comment puis-je vous aider ?",
};

export function TestChatFigure() {
  const [messages, setMessages] = useState<DemoMessage[]>([GREETING]);
  const [asked, setAsked] = useState<number[]>([]);
  const [typing, setTyping] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const log = useRef<HTMLDivElement>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  function ask(index: number) {
    if (typing) return;
    const item = DEMO[index];
    setAsked((current) => [...current, index]);
    setMessages((current) => [...current, { from: "client", text: item.question }]);
    setTyping(true);
    timer.current = setTimeout(() => {
      setMessages((current) => [...current, { from: "bot", text: item.answer }]);
      setTyping(false);
    }, 700);
  }

  function reset() {
    if (timer.current) clearTimeout(timer.current);
    setMessages([GREETING]);
    setAsked([]);
    setTyping(false);
  }

  return (
    <MockWindow url="extravertyai.com/projects/…/setup">
      <div aria-hidden="true">
        <MockStepper current={5} />
      </div>
      <div className="mt-1">
        <MockHeading title="Testez-le comme un client" description="Touchez une question : Nova répond avec des connaissances d’exemple." />
      </div>
      <div
        ref={log}
        role="log"
        aria-live="polite"
        aria-label="Conversation de test"
        className="mt-4 grid max-h-72 gap-2 overflow-y-auto rounded-lg border bg-muted/40 p-3"
      >
        {messages.map((message, index) => (
          <div
            key={index}
            className={cn(
              "max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed",
              message.from === "bot"
                ? "justify-self-start rounded-bl-sm border bg-background text-foreground"
                : "justify-self-end rounded-br-sm bg-primary text-primary-foreground",
            )}
          >
            {message.from === "bot" && <span className="mb-0.5 block text-[10px] font-semibold text-muted-foreground">Nova</span>}
            <span className="sr-only">{message.from === "bot" ? "Nova : " : "Client : "}</span>
            {message.text}
          </div>
        ))}
        {typing && (
          <div className="justify-self-start rounded-2xl rounded-bl-sm border bg-background px-3 py-2 text-xs text-muted-foreground">
            Nova écrit…
          </div>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {DEMO.map((item, index) => (
          <Button
            key={item.question}
            type="button"
            size="xs"
            variant="outline"
            className="rounded-full"
            disabled={typing || asked.includes(index)}
            onClick={() => ask(index)}
          >
            {item.question}
          </Button>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-4">
        <Button type="button" size="sm" variant="ghost" onClick={reset} disabled={messages.length === 1 && !typing}>
          <RotateCcw />
          Recommencer
        </Button>
        <MockButton>
          <Power />
          Activer l’assistant
        </MockButton>
      </div>
    </MockWindow>
  );
}

export function ConnectionFigure() {
  const [method, setMethod] = useState<"qr" | "phone">("qr");
  const steps =
    method === "qr"
      ? ["Ouvrez WhatsApp sur votre téléphone.", "Appareils connectés", "Connecter un appareil", "Visez ce QR code avec votre téléphone."]
      : ["Ouvrez WhatsApp sur votre téléphone.", "Appareils connectés", "Connecter un appareil", "Connecter avec un numéro de téléphone, puis saisissez ce code."];
  return (
    <div className="grid items-center gap-5 md:grid-cols-[minmax(0,1fr)_200px]">
      <MockWindow url="extravertyai.com/projects/…/chat">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <MockHeading title="Connexion à WhatsApp" />
          <Segmented
            label="Méthode de connexion"
            value={method}
            onChange={setMethod}
            options={[
              { value: "qr", label: "QR code", icon: <QrCode /> },
              { value: "phone", label: "Numéro de téléphone", icon: <Smartphone /> },
            ]}
          />
        </div>
        <div className="mt-5 grid items-center gap-5 sm:grid-cols-[auto_minmax(0,1fr)]" aria-hidden="true">
          {method === "qr" ? (
            <SampleQr />
          ) : (
            <div className="grid justify-items-center gap-2">
              <div className="flex items-center gap-1 font-mono text-base font-semibold">
                {"K7QA-M2XP".split("").map((char, index) =>
                  char === "-" ? (
                    <span key={index} className="px-0.5 text-muted-foreground">
                      -
                    </span>
                  ) : (
                    <span key={index} className="flex h-9 w-7 items-center justify-center rounded-md border bg-background">
                      {char}
                    </span>
                  ),
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">Ne partagez jamais ce code.</p>
            </div>
          )}
          <ol className="grid gap-2 text-xs">
            {steps.map((step, index) => (
              <li key={step} className="flex gap-2">
                <span className="font-mono text-muted-foreground">{index + 1}.</span>
                {step}
              </li>
            ))}
          </ol>
        </div>
        <div className="mt-4" aria-hidden="true">
          <MockWaiting>En attente du téléphone</MockWaiting>
        </div>
      </MockWindow>
      <div className="mx-auto w-[200px] rounded-[2rem] border-4 border-foreground/80 bg-background p-2 shadow-sm" aria-hidden="true">
        <div className="mx-auto mb-2 h-1.5 w-14 rounded-full bg-foreground/80" />
        <div className="grid min-h-72 content-start gap-4 rounded-[1.4rem] bg-muted/50 p-3">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <ArrowLeft className="size-3.5" />
            Appareils connectés
          </div>
          <div className="grid justify-items-center gap-3 pt-4 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-background">
              <Laptop className="size-6" />
            </span>
            <p className="text-[11px] leading-snug text-muted-foreground">ExtravertyAI apparaîtra ici, comme un ordinateur connecté.</p>
            <span className="rounded-full bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground">
              Connecter un appareil
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
