"use client";

import type { RefObject } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field";
import { MessageContentSchema } from "@/lib/message-schema";

const ComposerSchema = z.object({ content: MessageContentSchema });
type ComposerValues = z.infer<typeof ComposerSchema>;

export function ChatComposer({
  draft, contactName, isSending, textareaRef, onDraftChange, onSend,
}: {
  draft: string;
  contactName: string;
  isSending: boolean;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onDraftChange: (value: string) => void;
  onSend: (content: string) => Promise<void>;
}) {
  const form = useForm<ComposerValues>({
    resolver: zodResolver(ComposerSchema),
    defaultValues: { content: "" },
    values: { content: draft },
  });

  return (
    <form onSubmit={form.handleSubmit(({ content }) => onSend(content))} noValidate>
      <FieldGroup>
        <Controller
          name="content"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid} className="gap-2">
              <FieldLabel htmlFor="chat-message" className="sr-only">
                Message pour {contactName}
              </FieldLabel>
              <div className="flex items-end gap-2 rounded-xl border border-input bg-background p-2 shadow-sm focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/50">
                <Textarea
                  {...field}
                  ref={(element) => {
                    field.ref(element);
                    textareaRef.current = element;
                  }}
                  id="chat-message"
                  rows={1}
                  autoComplete="off"
                  aria-invalid={fieldState.invalid}
                  aria-describedby={fieldState.invalid ? "chat-composer-help chat-composer-error" : "chat-composer-help"}
                  onChange={(event) => {
                    field.onChange(event);
                    onDraftChange(event.target.value);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && !event.nativeEvent.isComposing) {
                      event.preventDefault();
                      event.currentTarget.form?.requestSubmit();
                    }
                  }}
                  placeholder="Écrire un message…"
                  className="min-h-11 max-h-40 flex-1 resize-none rounded-none border-0 bg-transparent px-2 py-3 shadow-none focus-visible:ring-0 dark:bg-transparent"
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={!draft.trim() || isSending}
                  aria-label={isSending ? "Envoi en cours" : "Envoyer le message"}
                  title="Envoyer · Ctrl / ⌘ + Entrée"
                  className="size-11 shrink-0 rounded-full"
                >
                  {isSending ? <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" /> : <ArrowUp aria-hidden="true" className="size-5" />}
                </Button>
              </div>
              <p id="chat-composer-help" className="sr-only">
                Entrée pour une nouvelle ligne. Ctrl ou Commande et Entrée pour envoyer.
              </p>
              {fieldState.invalid && <FieldError id="chat-composer-error" errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </FieldGroup>
    </form>
  );
}
