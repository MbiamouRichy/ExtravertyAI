"use client";

import { useEffect, useState } from "react";
import { Bot, CheckCheck, Clock3, Search, Sparkles, Zap } from "lucide-react";

import { cn } from "@/lib/utils";

const script = [
  { from: "client", text: "Bonjour, la robe en lin existe en taille M ?" },
  {
    from: "ai",
    text: "Bonjour Aïcha 👋 Oui, il reste 3 pièces en M : beige et sauge. Laquelle vous ferait plaisir ?",
  },
  { from: "client", text: "Sauge ! Livraison possible à Douala demain ?" },
  {
    from: "ai",
    text: "Oui, livraison express demain avant 18 h. Je vous envoie le lien de paiement ?",
  },
] as const;

// Always keep the first exchange on screen so the preview never looks empty.
const FIRST_FRAME = 2;

const inbox = [
  { name: "Aïcha N.", preview: "Sauge ! Livraison possible…", instinct: "interesting", active: true },
  { name: "Marc T.", preview: "Merci, c’est noté 🙏", instinct: null, active: false },
  { name: "Sarah K.", preview: "Note vocale · 0:14", instinct: "follow_up", active: false },
  { name: "Boutique Elo", preview: "Vous avez le catalogue ?", instinct: null, active: false },
] as const;

export function HeroPreview() {
  const [visible, setVisible] = useState<number>(FIRST_FRAME);
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let timer: ReturnType<typeof setTimeout>;
    if (reduce) {
      timer = setTimeout(() => setVisible(script.length), 0);
      return () => clearTimeout(timer);
    }
    let step = FIRST_FRAME;
    const tick = () => {
      if (step >= script.length) {
        timer = setTimeout(() => {
          step = FIRST_FRAME;
          setVisible(FIRST_FRAME);
          timer = setTimeout(tick, 1400);
        }, 5000);
        return;
      }
      if (script[step].from === "ai") {
        setTyping(true);
        timer = setTimeout(() => {
          setTyping(false);
          step += 1;
          setVisible(step);
          timer = setTimeout(tick, 1600);
        }, 1300);
      } else {
        step += 1;
        setVisible(step);
        timer = setTimeout(tick, 1100);
      }
    };
    timer = setTimeout(tick, 1800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div aria-hidden="true" className="relative isolate px-2 py-6 sm:px-4">
      {/* Ambient glow, derived from the theme foreground. */}
      <div className="absolute inset-0 -z-10 rounded-[2.5rem] bg-[radial-gradient(ellipse_at_center,color-mix(in_oklch,var(--foreground)_10%,transparent),transparent_70%)] blur-2xl" />

      <div className="overflow-hidden rounded-2xl border bg-card shadow-2xl shadow-foreground/10 ring-1 ring-foreground/5">
        <div className="flex items-center gap-2 border-b bg-muted/50 px-4 py-2.5">
          <span className="size-2.5 rounded-full bg-foreground/15" />
          <span className="size-2.5 rounded-full bg-foreground/15" />
          <span className="size-2.5 rounded-full bg-foreground/15" />
          <div className="mx-auto flex h-6 w-1/2 max-w-64 items-center justify-center rounded-md border bg-background text-[11px] text-muted-foreground">
            app.extravertyai.com
          </div>
        </div>

        <div className="grid h-[25rem] grid-cols-1 sm:h-[23rem] sm:grid-cols-[13rem_1fr]">
          <div className="hidden flex-col border-r sm:flex">
            <div className="flex items-center gap-2 border-b px-3 py-2.5 text-xs text-muted-foreground">
              <Search className="size-3.5" />
              Rechercher
            </div>
            <ul className="flex-1 space-y-0.5 p-1.5">
              {inbox.map((item) => (
                <li
                  key={item.name}
                  className={cn("flex items-start gap-2.5 rounded-lg px-2 py-2", item.active && "bg-muted")}
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary font-heading text-[11px] font-semibold">
                    {item.name.slice(0, 1)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1">
                      <span className="truncate text-xs font-medium">{item.name}</span>
                      {item.instinct === "interesting" && <Sparkles className="size-3 shrink-0" />}
                      {item.instinct === "follow_up" && (
                        <Clock3 className="size-3 shrink-0 text-muted-foreground" />
                      )}
                    </span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {item.preview}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex min-w-0 flex-col">
            <div className="flex items-center justify-between border-b px-4 py-2.5">
              <div className="flex items-center gap-2.5">
                <span className="flex size-7 items-center justify-center rounded-full bg-secondary font-heading text-[11px] font-semibold">
                  A
                </span>
                <div className="leading-tight">
                  <p className="text-xs font-medium">Aïcha N.</p>
                  <p className="text-[10px] text-muted-foreground">En ligne</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2 py-0.5 text-[10px]">
                <Bot className="size-3" />
                IA active
              </span>
            </div>

            <div className="flex flex-1 flex-col justify-end gap-2 overflow-hidden bg-[radial-gradient(var(--border)_1px,transparent_1px)] bg-size-[16px_16px] p-4">
              {script.slice(0, visible).map((message, index) => (
                <div
                  key={index}
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300",
                    message.from === "client"
                      ? "self-start rounded-bl-sm border bg-background"
                      : "self-end rounded-br-sm bg-primary text-primary-foreground",
                  )}
                >
                  {message.from === "ai" && (
                    <span className="mb-0.5 flex items-center gap-1 text-[9px] uppercase tracking-wider opacity-70">
                      <Sparkles className="size-2.5" />
                      Réponse IA
                    </span>
                  )}
                  {message.text}
                  {message.from === "ai" && <CheckCheck className="ml-1 inline size-3 opacity-70" />}
                </div>
              ))}
              {typing && (
                <div className="flex gap-1 self-end rounded-2xl rounded-br-sm bg-primary/90 px-3 py-2.5">
                  {[0, 150, 300].map((delay) => (
                    <span
                      key={delay}
                      className="size-1.5 rounded-full bg-primary-foreground/80 motion-safe:animate-bounce"
                      style={{ animationDelay: `${delay}ms` }}
                    />
                  ))}
                </div>
              )}
            </div>
            <div className="border-t p-2.5">
              <div className="flex h-8 items-center justify-between rounded-lg border bg-background px-3 text-[11px] text-muted-foreground">
                L’IA gère cette conversation
                <span className="font-medium text-foreground">Reprendre la main</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating proof points. */}
      <div className="absolute -top-1 right-0 flex items-center gap-2 rounded-xl border bg-background/90 px-3 py-2 shadow-lg shadow-foreground/10 backdrop-blur motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-2 motion-safe:delay-700 motion-safe:fill-mode-backwards motion-safe:duration-500 sm:-right-4">
        <span className="flex size-6 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Sparkles className="size-3.5" />
        </span>
        <span className="leading-tight">
          <span className="block text-[10px] text-muted-foreground">Instinct IA</span>
          <span className="block text-xs font-medium">Prospect intéressant</span>
        </span>
      </div>
      <div className="absolute -bottom-1 left-0 flex items-center gap-2 rounded-xl border bg-background/90 px-3 py-2 shadow-lg shadow-foreground/10 backdrop-blur motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:delay-1000 motion-safe:fill-mode-backwards motion-safe:duration-500 sm:-left-4">
        <span className="flex size-6 items-center justify-center rounded-lg border bg-background">
          <Zap className="size-3.5" />
        </span>
        <span className="leading-tight">
          <span className="block text-[10px] text-muted-foreground">Disponible 24 h/24</span>
          <span className="block text-xs font-medium">Réponse en quelques secondes</span>
        </span>
      </div>
    </div>
  );
}
