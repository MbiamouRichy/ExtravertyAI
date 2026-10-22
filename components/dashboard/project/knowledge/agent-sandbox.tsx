"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Bot, CircleAlert, FlaskConical, Loader2, RotateCcw, SendHorizontal, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { testAgentAction } from "@/app/actions/agent-improvement";
import type { SandboxTrace } from "@/lib/agent-sandbox";
import { cn } from "@/lib/utils";

type Turn =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; trace: SandboxTrace };

const KIND_LABEL: Record<string, string> = {
  FAQ: "Question",
  TEXT: "Information",
  PRODUCT: "Produit",
  CHUNK: "Document",
};

const SUGGESTIONS = [
  "Bonjour, quels sont vos horaires ?",
  "Vous livrez en dehors de la capitale ?",
  "Combien coûte votre produit le plus vendu ?",
];

const ComposerSchema = z.object({
  message: z.string().trim().min(1, "Écrivez un message.").max(1000, "1 000 caractères au maximum."),
});

function Trace({ trace }: { trace: SandboxTrace }) {
  return (
    <div className="mt-2 space-y-2 rounded-xl border bg-muted/30 p-3 text-xs">
      <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Trace de la réponse</p>
      {trace.sources.length ? (
        <div>
          <p className="text-muted-foreground">Données utilisées :</p>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {trace.sources.map((source) => (
              <li key={source.id} className="max-w-full truncate rounded-md border bg-background px-1.5 py-0.5">
                <span className="text-muted-foreground">{KIND_LABEL[source.kind] ?? source.kind} · </span>
                {source.title}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-muted-foreground">
          Aucune donnée de la base de connaissances ne correspondait : réponse fondée sur vos instructions seules.
        </p>
      )}
      <p className="text-muted-foreground">
        Ton {trace.settings.tone.toLowerCase()} · longueur {trace.settings.length.toLowerCase()} ·{" "}
        {trace.settings.language.toLowerCase()} · emojis {trace.settings.emojis ? "autorisés" : "désactivés"}
      </p>
      {trace.missingInfo && (
        <p className="flex items-start gap-1.5 font-medium">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          Information manquante signalée. En conversation réelle, la question
          apparaîtrait dans « À améliorer » pour que vous y répondiez une fois pour toutes.
        </p>
      )}
    </div>
  );
}

export function AgentSandbox({ projectId, initialRemaining }: { projectId: string; initialRemaining: number }) {
  const id = useId();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [remaining, setRemaining] = useState(initialRemaining);
  const [thinking, setThinking] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const form = useForm<z.input<typeof ComposerSchema>, unknown, z.output<typeof ComposerSchema>>({
    resolver: zodResolver(ComposerSchema),
    defaultValues: { message: "" },
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [turns, thinking]);

  async function send({ message }: z.output<typeof ComposerSchema>) {
    const history: Turn[] = [...turns, { role: "user", content: message }];
    setTurns(history);
    form.reset();
    setThinking(true);
    const result = await testAgentAction({
      projectId,
      messages: history.slice(-20).map(({ role, content }) => ({ role, content })),
    });
    setThinking(false);
    if (!result.success) {
      toast.error(result.error);
      setTurns(turns);
      form.setValue("message", message);
      return;
    }
    setRemaining(result.remaining);
    setTurns([...history, { role: "assistant", content: result.reply, trace: result.trace }]);
  }

  return (
    <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <section
        aria-labelledby={`${id}-title`}
        className="flex h-[min(32rem,75dvh)] min-w-0 flex-col overflow-hidden rounded-2xl border bg-card"
      >
        <header className="flex min-w-0 items-center gap-2 border-b px-3 py-2.5 sm:px-4 sm:py-3">
          <h2
            id={`${id}-title`}
            className="flex min-w-0 flex-1 items-center gap-2 text-sm font-semibold tracking-normal"
          >
            <FlaskConical aria-hidden="true" className="size-4 shrink-0" />
            <span className="truncate">Conversation de test</span>
          </h2>
          {/* Compteur visible ici sur mobile : le panneau latéral passe sous le chat. */}
          <span className="shrink-0 rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground tabular-nums lg:hidden">
            {remaining} test{remaining > 1 ? "s" : ""}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!turns.length || thinking}
            onClick={() => setTurns([])}
            aria-label="Recommencer la conversation de test"
            className="shrink-0 max-sm:size-8 max-sm:px-0"
          >
            <RotateCcw data-icon="inline-start" className="max-sm:m-0" />
            <span className="hidden sm:inline">Recommencer</span>
          </Button>
        </header>

        <div aria-live="polite" className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-3 sm:p-4">
          {!turns.length && (
            <div className="flex min-h-full flex-col items-center justify-center gap-4 py-4 text-center sm:py-8">
              <p className="max-w-sm text-pretty text-sm text-muted-foreground">
                Jouez le rôle d’un client. L’assistant répond avec vos instructions
                et votre base de connaissances, sans rien envoyer sur WhatsApp.
              </p>
              <div className="flex w-full max-w-md flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center">
                {SUGGESTIONS.map((suggestion) => (
                  <Button
                    key={suggestion}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-auto max-w-full justify-start whitespace-normal py-2 text-left leading-snug sm:justify-center sm:text-center"
                    disabled={thinking || remaining <= 0}
                    onClick={() => void send({ message: suggestion })}
                  >
                    {suggestion}
                  </Button>
                ))}
              </div>
            </div>
          )}
          {turns.map((turn, index) => (
            <div key={index} className={cn("flex gap-2", turn.role === "assistant" && "flex-row-reverse")}>
              <span className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full border bg-background">
                {turn.role === "user" ? (
                  <UserRound aria-hidden="true" className="size-3.5" />
                ) : (
                  <Bot aria-hidden="true" className="size-3.5" />
                )}
              </span>
              <div className={cn("min-w-0 max-w-[85%]", turn.role === "assistant" && "flex flex-col items-end")}>
                <p className="sr-only">{turn.role === "user" ? "Client test :" : "Assistant :"}</p>
                <p
                  dir="auto"
                  className={cn(
                    "whitespace-pre-wrap wrap-anywhere rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                    turn.role === "user" ? "rounded-bl-md border bg-background" : "rounded-br-md bg-primary text-primary-foreground",
                  )}
                >
                  {turn.content}
                </p>
                {turn.role === "assistant" && <Trace trace={turn.trace} />}
              </div>
            </div>
          ))}
          {thinking && (
            <p role="status" className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
              <Loader2 aria-hidden="true" className="size-3.5 animate-spin motion-reduce:animate-none" />
              L’assistant rédige sa réponse…
            </p>
          )}
          {turns.length > 0 && <div ref={endRef} />}
        </div>

        <form noValidate onSubmit={form.handleSubmit(send)} className="border-t p-2.5 sm:p-3">
          <Controller
            name="message"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="gap-1.5">
                <FieldLabel htmlFor={`${id}-message`} className="sr-only">
                  Message du client test
                </FieldLabel>
                <div className="flex items-end gap-2">
                  <Textarea
                    {...field}
                    id={`${id}-message`}
                    rows={2}
                    maxLength={1000}
                    placeholder={remaining > 0 ? "Écrivez comme un client…" : "Limite quotidienne atteinte"}
                    disabled={thinking || remaining <= 0}
                    aria-invalid={fieldState.invalid}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                        event.preventDefault();
                        void form.handleSubmit(send)();
                      }
                    }}
                    className="min-h-11 min-w-0 resize-none"
                  />
                  <Button type="submit" size="icon" className="shrink-0" disabled={thinking || remaining <= 0} aria-label="Envoyer le message de test">
                    {thinking ? (
                      <Loader2 aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
                    ) : (
                      <SendHorizontal aria-hidden="true" />
                    )}
                  </Button>
                </div>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
        </form>
      </section>

      <aside className="min-w-0 space-y-3 rounded-2xl border bg-card p-4 text-sm">
        <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Tests aujourd’hui</p>
        <p className="font-heading text-3xl font-bold tracking-tight tabular-nums">{remaining}</p>
        <p className="text-xs text-muted-foreground">
          tests restants sur 24 h glissantes. Les tests ne consomment pas votre
          quota de messages WhatsApp.
        </p>
        <hr />
        <p className="text-xs text-muted-foreground">
          Une réponse vous semble fausse ? Ajoutez l’information dans l’onglet
          « Questions et infos », puis testez à nouveau.
        </p>
      </aside>
    </div>
  );
}
