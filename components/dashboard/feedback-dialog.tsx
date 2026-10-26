"use client";

import { useId, useState } from "react";
import { usePathname } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Bug,
  CircleCheck,
  Heart,
  Lightbulb,
  Loader2,
  MessageSquareHeart,
  Send,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { submitProductFeedbackAction } from "@/app/actions/product-feedback";
import { FEEDBACK_MESSAGE_MAX } from "@/lib/product-feedback";
import { cn } from "@/lib/utils";

const KINDS = [
  {
    value: "BUG",
    label: "Un bug",
    icon: Bug,
    placeholder:
      "Ce que vous faisiez, ce qui s’est passé et ce que vous attendiez…",
  },
  {
    value: "IDEA",
    label: "Une idée",
    icon: Lightbulb,
    placeholder: "Ce qui vous ferait gagner du temps ou manque aujourd’hui…",
  },
  {
    value: "PRAISE",
    label: "Ça marche bien",
    icon: Heart,
    placeholder: "Ce qui vous plaît ou vous aide au quotidien…",
  },
] as const;

const Schema = z.object({
  kind: z.enum(["BUG", "IDEA", "PRAISE"]),
  message: z
    .string()
    .trim()
    .min(10, "Décrivez votre retour en quelques mots (10 caractères minimum).")
    .max(
      FEEDBACK_MESSAGE_MAX,
      `${FEEDBACK_MESSAGE_MAX} caractères au maximum.`,
    ),
  contactOk: z.boolean(),
});
type Values = z.infer<typeof Schema>;
const DEFAULTS: Values = { kind: "IDEA", message: "", contactOk: true };

/**
 * « Votre avis » : bug, idée ou compliment, envoyé sans quitter la page.
 * La page d’origine (chemin seul) accompagne le retour pour le comprendre.
 */
export function FeedbackDialog() {
  const id = useId();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const form = useForm<Values>({
    resolver: zodResolver(Schema),
    defaultValues: DEFAULTS,
  });
  const kind = useWatch({ control: form.control, name: "kind" });
  const message = useWatch({ control: form.control, name: "message" });
  const current = KINDS.find((item) => item.value === kind) ?? KINDS[1];

  function changeOpen(next: boolean) {
    if (form.formState.isSubmitting) return;
    setOpen(next);
    if (!next) {
      // Réinitialisé à la fermeture, après l’animation.
      setTimeout(() => {
        setSent(false);
        form.reset(DEFAULTS);
      }, 200);
    }
  }

  const submit = form.handleSubmit(async (values) => {
    try {
      const result = await submitProductFeedbackAction({
        ...values,
        pagePath: pathname?.slice(0, 200),
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setSent(true);
    } catch {
      toast.error("Connexion interrompue. Votre message n’a pas été envoyé.");
    }
  });

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <MessageSquareHeart data-icon="inline-start" />
              <span className="hidden sm:inline">Votre avis</span>
              <span className="sr-only sm:hidden">Donner votre avis</span>
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent>Signaler un bug ou proposer une idée</TooltipContent>
      </Tooltip>

      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        {sent ? (
          <div
            role="status"
            className="flex flex-col items-center py-6 text-center"
          >
            <span className="flex size-12 items-center justify-center rounded-full border bg-muted/50">
              <CircleCheck aria-hidden="true" className="size-6" />
            </span>
            <DialogTitle className="mt-4 text-lg">
              Merci pour votre retour
            </DialogTitle>
            <DialogDescription className="mt-2 max-w-sm">
              Chaque message est lu par l’équipe.
              {form.getValues("contactOk")
                ? " Nous vous répondrons par e-mail si nous avons besoin de précisions."
                : ""}
            </DialogDescription>
            <div className="mt-6 flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSent(false);
                  form.reset(DEFAULTS);
                }}
              >
                Envoyer un autre retour
              </Button>
              <Button type="button" onClick={() => changeOpen(false)}>
                Fermer
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="space-y-5">
            <DialogHeader>
              <DialogTitle>Votre avis compte</DialogTitle>
              <DialogDescription>
                Signalez un bug, proposez une idée ou dites-nous ce qui
                fonctionne bien.
              </DialogDescription>
            </DialogHeader>

            <FieldGroup>
              <Controller
                name="kind"
                control={form.control}
                render={({ field, fieldState }) => (
                  <FieldSet data-invalid={fieldState.invalid}>
                    <FieldLegend variant="label" className="sr-only">
                      Type de retour
                    </FieldLegend>
                    <RadioGroup
                      name={field.name}
                      value={field.value}
                      onValueChange={field.onChange}
                      className="grid grid-cols-3 gap-2"
                    >
                      {KINDS.map(({ value, label, icon: Icon }) => (
                        <FieldLabel
                          key={value}
                          htmlFor={`${id}-${value}`}
                          className="w-full! cursor-pointer rounded-xl border p-3 font-normal transition-colors hover:bg-muted/40 has-data-[state=checked]:border-primary has-data-[state=checked]:bg-muted/50"
                        >
                          <span className="flex w-full flex-col items-center gap-2 text-center">
                            <Icon aria-hidden="true" className="size-5" />
                            <span className="text-xs font-medium sm:text-sm">
                              {label}
                            </span>
                            <RadioGroupItem
                              id={`${id}-${value}`}
                              value={value}
                              className="sr-only"
                            />
                          </span>
                        </FieldLabel>
                      ))}
                    </RadioGroup>
                  </FieldSet>
                )}
              />

              <Controller
                name="message"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={`${id}-message`}>
                      Votre message
                    </FieldLabel>
                    <Textarea
                      {...field}
                      id={`${id}-message`}
                      rows={5}
                      maxLength={FEEDBACK_MESSAGE_MAX}
                      placeholder={current.placeholder}
                      aria-invalid={fieldState.invalid}
                      aria-describedby={`${id}-message-help`}
                      onKeyDown={(event) => {
                        // Ctrl/⌘ + Entrée envoie, comme dans la messagerie.
                        if (
                          event.key === "Enter" &&
                          (event.metaKey || event.ctrlKey)
                        ) {
                          event.preventDefault();
                          void submit();
                        }
                      }}
                      className="min-h-32 resize-y"
                    />
                    <FieldDescription
                      id={`${id}-message-help`}
                      className="flex justify-between gap-3 text-xs"
                    >
                      <span>
                        {kind === "BUG"
                          ? "La page actuelle est jointe pour nous aider à reproduire le problème."
                          : "La page actuelle est jointe à votre message."}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 tabular-nums",
                          message.length > FEEDBACK_MESSAGE_MAX * 0.9 &&
                            "text-foreground",
                        )}
                      >
                        {message.length.toLocaleString("fr-FR")} /{" "}
                        {FEEDBACK_MESSAGE_MAX.toLocaleString("fr-FR")}
                      </span>
                    </FieldDescription>
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />

              <Controller
                name="contactOk"
                control={form.control}
                render={({ field }) => (
                  <Field orientation="horizontal" className="items-start gap-3">
                    <Checkbox
                      id={`${id}-contact`}
                      checked={field.value}
                      onCheckedChange={(checked) =>
                        field.onChange(checked === true)
                      }
                      className="mt-0.5"
                    />
                    <FieldLabel
                      htmlFor={`${id}-contact`}
                      className="font-normal leading-snug"
                    >
                      Vous pouvez me recontacter par e-mail au sujet de ce
                      retour
                    </FieldLabel>
                  </Field>
                )}
              />
            </FieldGroup>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={form.formState.isSubmitting}
                onClick={() => changeOpen(false)}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? (
                  <Loader2
                    data-icon="inline-start"
                    className="animate-spin motion-reduce:animate-none"
                  />
                ) : (
                  <Send data-icon="inline-start" />
                )}
                {form.formState.isSubmitting ? "Envoi…" : "Envoyer"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
