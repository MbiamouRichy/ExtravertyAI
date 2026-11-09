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
    label: "Bug",
    icon: Bug,
    placeholder: "Ce que vous faisiez, ce qui s’est passé, ce que vous attendiez…",
  },
  {
    value: "IDEA",
    label: "Idée",
    icon: Lightbulb,
    placeholder: "Ce qui vous ferait gagner du temps ou vous manque…",
  },
  {
    value: "PRAISE",
    label: "J’aime",
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
/** Le compteur n’apparaît qu’à l’approche de la limite. */
const COUNTER_FROM = Math.floor(FEEDBACK_MESSAGE_MAX * 0.9);

/**
 * « Votre avis » : bug, idée ou compliment, envoyé sans quitter la page.
 * Le chemin de la page d’origine accompagne le retour pour le comprendre.
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
  const submitting = form.formState.isSubmitting;

  function changeOpen(next: boolean) {
    if (submitting) return;
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

      <DialogContent className="max-h-[90dvh] overflow-y-auto p-5 sm:p-6">
        {sent ? (
          <div
            role="status"
            className="flex flex-col items-center py-2 text-center"
          >
            <span className="flex size-11 items-center justify-center rounded-full bg-muted">
              <CircleCheck aria-hidden="true" className="size-5" />
            </span>
            <DialogTitle className="mt-4 text-lg">{"Merci !"}</DialogTitle>
            <DialogDescription className="mt-1.5 max-w-xs">
              {form.getValues("contactOk")
                ? "Votre message est bien arrivé. Nous vous écrirons si nous avons besoin de précisions."
                : "Votre message est bien arrivé. L’équipe le lira avec attention."}
            </DialogDescription>
            <div className="mt-6 flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSent(false);
                  form.reset(DEFAULTS);
                }}
              >
                Nouveau message
              </Button>
              <Button type="button" onClick={() => changeOpen(false)}>
                Fermer
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="flex flex-col gap-5">
            <DialogHeader className="gap-1.5 pr-8">
              <DialogTitle className="text-lg">Votre avis</DialogTitle>
              <DialogDescription>
                {"Un bug, une idée ou ce qui vous plaît : l’équipe lit chaque message."}
              </DialogDescription>
            </DialogHeader>

            <FieldGroup className="gap-4">
              <Controller
                name="kind"
                control={form.control}
                render={({ field, fieldState }) => (
                  <FieldSet data-invalid={fieldState.invalid}>
                    <FieldLegend variant="label" className="sr-only">
                      Type de retour
                    </FieldLegend>
                    {/* Sélecteur segmenté, au style des onglets du projet. */}
                    <RadioGroup
                      name={field.name}
                      value={field.value}
                      onValueChange={field.onChange}
                      className="@container grid grid-cols-3 gap-1 rounded-lg bg-muted p-[3px]"
                    >
                      {KINDS.map(({ value, label, icon: Icon }) => (
                        <FieldLabel
                          key={value}
                          htmlFor={`${id}-${value}`}
                          className={cn(
                            "w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-transparent px-1 py-1.5 text-sm font-medium text-foreground/60 transition-colors hover:text-foreground @[16rem]:h-8 @[16rem]:flex-row @[16rem]:gap-1.5 @[16rem]:py-0",
                            "has-focus-visible:border-ring has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50",
                            "has-data-[state=checked]:border-transparent has-data-[state=checked]:bg-background has-data-[state=checked]:text-foreground has-data-[state=checked]:shadow-sm dark:has-data-[state=checked]:border-input dark:has-data-[state=checked]:bg-input/30",
                          )}
                        >
                          <Icon aria-hidden="true" className="size-4 shrink-0" />
                          {label}
                          <RadioGroupItem
                            id={`${id}-${value}`}
                            value={value}
                            className="sr-only"
                          />
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
                  <Field data-invalid={fieldState.invalid} className="gap-2">
                    <FieldLabel htmlFor={`${id}-message`} className="sr-only">
                      Message
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
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                    <FieldDescription
                      id={`${id}-message-help`}
                      className="flex items-start justify-between gap-3 text-xs"
                    >
                      <span>L’adresse de cette page est jointe au message.</span>
                      {message.length >= COUNTER_FROM && (
                        <span className="shrink-0 text-foreground tabular-nums">
                          {message.length.toLocaleString("fr-FR")} /{" "}
                          {FEEDBACK_MESSAGE_MAX.toLocaleString("fr-FR")}
                        </span>
                      )}
                    </FieldDescription>
                  </Field>
                )}
              />

              <Controller
                name="contactOk"
                control={form.control}
                render={({ field }) => (
                  <Field orientation="horizontal" className="items-start gap-2.5">
                    <Checkbox
                      id={`${id}-contact`}
                      checked={field.value}
                      onCheckedChange={(checked) =>
                        field.onChange(checked === true)
                      }
                      className="mt-px"
                    />
                    <FieldLabel
                      htmlFor={`${id}-contact`}
                      className="font-normal leading-snug"
                    >
                      L’équipe peut me répondre par e-mail
                    </FieldLabel>
                  </Field>
                )}
              />
            </FieldGroup>

            <div className="flex gap-2 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={submitting}
                onClick={() => changeOpen(false)}
                className="flex-1 sm:flex-none"
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="flex-1 sm:flex-none"
              >
                {submitting ? (
                  <Loader2
                    data-icon="inline-start"
                    className="animate-spin motion-reduce:animate-none"
                  />
                ) : (
                  <Send data-icon="inline-start" />
                )}
                {submitting ? "Envoi…" : "Envoyer"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
