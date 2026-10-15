"use client";

import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  ArrowUp,
  Loader2,
  Lock,
  Mic,
  Paperclip,
  Smile,
  Sparkles,
  WandSparkles,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export type ComposerMode = "reply" | "note";

const MAX_LENGTH = 4096;

const schema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "Le message est vide.")
    .max(MAX_LENGTH, `${MAX_LENGTH} caractères maximum.`),
});

type Values = z.infer<typeof schema>;

export function Composer({
  conversationId,
  aiActive,
  suggestions,
  onSend,
}: {
  conversationId: string;
  aiActive: boolean;
  suggestions: string[];
  onSend: (text: string, mode: ComposerMode) => void;
}) {
  const [mode, setMode] = useState<ComposerMode>("reply");
  const [improving, setImproving] = useState(false);
  const fieldId = `composer-${conversationId}`;

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { text: "" },
  });

  const text = useWatch({ control: form.control, name: "text" });
  const isNote = mode === "note";

  function submit(values: Values) {
    onSend(values.text.trim(), mode);
    form.reset({ text: "" });
  }

  async function improve() {
    const current = form.getValues("text").trim();
    if (!current) return;
    setImproving(true);
    // Maquette : reformulation simulée côté client.
    await new Promise((resolve) => setTimeout(resolve, 900));
    const polished = current.charAt(0).toUpperCase() + current.slice(1);
    form.setValue(
      "text",
      /[.!?…]$/.test(polished) ? polished : `${polished}. Belle journée à vous !`,
      { shouldDirty: true },
    );
    setImproving(false);
  }

  return (
    <div className="chat-floating-composer relative border-t bg-background px-3 pb-3 pt-2 sm:px-4">
      {suggestions.length > 0 && !isNote && !text && (
        <div className="mb-2 flex items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]">
          <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
            <Sparkles aria-hidden="true" className="size-3" />
            Suggestions
          </span>
          {suggestions.map((suggestion) => (
            <Button
              key={suggestion}
              type="button"
              variant="outline"
              size="xs"
              className="max-w-72 shrink-0 justify-start truncate rounded-full font-normal"
              onClick={() => {
                form.setValue("text", suggestion, { shouldDirty: true });
                document.getElementById(fieldId)?.focus();
              }}
            >
              <span className="truncate">{suggestion}</span>
            </Button>
          ))}
        </div>
      )}

      <form onSubmit={form.handleSubmit(submit)} noValidate>
        <Controller
          name="text"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid} className="gap-1.5">
              <FieldLabel htmlFor={fieldId} className="sr-only">
                {isNote ? "Note interne" : "Message au contact"}
              </FieldLabel>
              <InputGroup
                className={cn(
                  "rounded-xl bg-background transition-colors",
                  isNote && "border-dashed border-foreground/40 bg-muted/50",
                )}
              >
                <InputGroupAddon align="block-start" className="gap-1 border-b pb-1.5">
                  <div role="group" aria-label="Type de message" className="flex gap-0.5">
                    <InputGroupButton
                      size="xs"
                      variant={!isNote ? "secondary" : "ghost"}
                      aria-pressed={!isNote}
                      onClick={() => setMode("reply")}
                    >
                      Répondre
                    </InputGroupButton>
                    <InputGroupButton
                      size="xs"
                      variant={isNote ? "secondary" : "ghost"}
                      aria-pressed={isNote}
                      onClick={() => setMode("note")}
                    >
                      <Lock />
                      Note interne
                    </InputGroupButton>
                  </div>
                  {aiActive && !isNote && (
                    <span className="ml-auto hidden text-[11px] font-normal sm:inline">
                      Envoyer un message met l’IA en pause
                    </span>
                  )}
                </InputGroupAddon>
                <InputGroupTextarea
                  {...field}
                  id={fieldId}
                  rows={1}
                  maxLength={MAX_LENGTH}
                  aria-invalid={fieldState.invalid}
                  disabled={improving}
                  placeholder={
                    isNote
                      ? "Visible uniquement par votre équipe…"
                      : "Écrire un message…"
                  }
                  className="max-h-40 min-h-11 px-3"
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                      event.preventDefault();
                      void form.handleSubmit(submit)();
                    }
                  }}
                />
                <InputGroupAddon align="block-end" className="gap-0.5">
                  {[
                    { icon: Paperclip, label: "Joindre un fichier" },
                    { icon: Smile, label: "Insérer un emoji" },
                    { icon: Mic, label: "Enregistrer une note vocale" },
                  ].map(({ icon: Icon, label }) => (
                    <Tooltip key={label}>
                      <TooltipTrigger asChild>
                        <InputGroupButton size="icon-sm" aria-label={label} disabled={isNote}>
                          <Icon />
                        </InputGroupButton>
                      </TooltipTrigger>
                      <TooltipContent>{label}</TooltipContent>
                    </Tooltip>
                  ))}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <InputGroupButton
                        size="sm"
                        className="ml-0.5 h-8 px-2"
                        onClick={improve}
                        disabled={!text.trim() || improving}
                      >
                        {improving ? <Loader2 className="animate-spin" /> : <WandSparkles />}
                        <span className="hidden sm:inline">Améliorer</span>
                      </InputGroupButton>
                    </TooltipTrigger>
                    <TooltipContent>Reformuler avec l’IA</TooltipContent>
                  </Tooltip>
                  <span className="ml-auto mr-1 hidden items-center gap-1 text-[11px] text-muted-foreground md:flex">
                    <Kbd>Shift</Kbd>+<Kbd>Entrée</Kbd> nouvelle ligne
                  </span>
                  <InputGroupButton
                    type="submit"
                    size="icon-sm"
                    variant="default"
                    className="rounded-lg max-md:ml-auto"
                    disabled={!text.trim() || improving}
                    aria-label={isNote ? "Ajouter la note" : "Envoyer le message"}
                  >
                    <ArrowUp />
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
              {fieldState.invalid && fieldState.error?.message !== "Le message est vide." && (
                <FieldError errors={[fieldState.error]} />
              )}
            </Field>
          )}
        />
      </form>
    </div>
  );
}
