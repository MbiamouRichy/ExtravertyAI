"use client";

import Link from "next/link";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { m } from "motion/react";
import { ArrowRight, Building2, ShieldCheck, UserRound } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { WhatsAppIcon } from "@/components/social-icon";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Eyebrow, Serif } from "@/components/website/vitrine/primitives";
import { SPRING } from "@/components/website/vitrine/motion";

import {
  CONTACT_DEFAULTS,
  ContactFormSchema,
  NEEDS,
  WHATSAPP_CHAT_URL,
  buildWhatsAppMessage,
  type ContactFormValues,
} from "./data";
import { Draft, MessagePreview, draftLines } from "./message-preview";

export function ContactComposer() {
  const form = useForm<ContactFormValues>({
    resolver: zodResolver(ContactFormSchema),
    mode: "onTouched",
    defaultValues: CONTACT_DEFAULTS,
  });
  const { control, handleSubmit, reset } = form;
  const [need, name, business, message] = useWatch({
    control,
    name: ["need", "name", "business", "message"],
  });
  const draft: ContactFormValues = { need, name, business, message };
  const [sent, setSent] = useState<ContactFormValues | null>(null);

  function onSubmit(values: ContactFormValues) {
    const url = `${WHATSAPP_CHAT_URL}?text=${encodeURIComponent(buildWhatsAppMessage(values))}`;
    // With a "noopener" feature window.open always returns null, which would
    // also send this tab to WhatsApp; the opener is cut right after instead.
    const opened = window.open(url, "_blank");
    if (opened) opened.opener = null;
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- absolute wa.me URL, popup blocked
    else window.location.assign(url);
    setSent(values);
    toast.success("Votre message est prêt dans WhatsApp", {
      description: "Relisez-le, puis envoyez-le depuis WhatsApp.",
    });
    reset(CONTACT_DEFAULTS);
  }

  return (
    <section aria-labelledby="contact-title" className="relative isolate grid lg:grid-cols-12">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(var(--border)_1px,transparent_1px)] bg-size-[22px_22px] mask-[radial-gradient(ellipse_70%_55%_at_20%_0%,black,transparent)]"
      />

      <div className="min-w-0 px-4 pt-14 pb-16 sm:px-8 md:pt-20 lg:col-span-7 lg:px-12 lg:pb-24">
        <Eyebrow>
          <span className="text-foreground">Contact</span>
          <span aria-hidden="true"> / </span>
          Réponse humaine sur WhatsApp
        </Eyebrow>
        <h1 id="contact-title" className="mt-5 max-w-2xl text-5xl text-balance md:text-6xl lg:text-7xl">
          Parlons de votre <Serif>service client.</Serif>
        </h1>
        <p className="mt-6 max-w-lg text-pretty text-muted-foreground md:text-lg">
          Racontez votre quotidien sur WhatsApp. Nous vous montrons ce que
          l’automatisation peut changer, sans engagement.
        </p>

        <form
          noValidate
          aria-label="Préparer mon message WhatsApp"
          onSubmit={handleSubmit(onSubmit)}
          className="mt-12"
        >
          <FieldGroup className="gap-7">
            <Controller
              name="need"
              control={control}
              render={({ field, fieldState }) => (
                <FieldSet data-invalid={fieldState.invalid}>
                  <FieldLegend variant="label">Je souhaite…</FieldLegend>
                  <RadioGroup
                    name={field.name}
                    value={field.value}
                    onValueChange={field.onChange}
                    className="flex flex-wrap gap-2"
                  >
                    {NEEDS.map((option) => {
                      const checked = field.value === option.value;
                      return (
                        <div key={option.value} className="relative rounded-full">
                          {checked && (
                            <m.span
                              layoutId="contact-need-pill"
                              transition={SPRING}
                              aria-hidden="true"
                              className="absolute inset-0 rounded-full bg-primary"
                            />
                          )}
                          <RadioGroupItem
                            ref={checked ? field.ref : undefined}
                            id={`need-${option.value}`}
                            value={option.value}
                            className="peer sr-only"
                          />
                          <FieldLabel
                            htmlFor={`need-${option.value}`}
                            className={cn(
                              "relative w-auto! cursor-pointer rounded-full border px-4 py-2 text-sm font-normal transition-colors",
                              "peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50",
                              checked
                                ? "border-transparent text-primary-foreground"
                                : "bg-background hover:bg-muted",
                            )}
                          >
                            {option.label}
                          </FieldLabel>
                        </div>
                      );
                    })}
                  </RadioGroup>
                </FieldSet>
              )}
            />

            <div className="grid gap-7 sm:grid-cols-2 sm:gap-4">
              <Controller
                name="name"
                control={control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="contact-name">Votre nom</FieldLabel>
                    <InputGroup className="h-11">
                      <InputGroupAddon>
                        <UserRound aria-hidden="true" />
                      </InputGroupAddon>
                      <InputGroupInput
                        {...field}
                        id="contact-name"
                        autoComplete="name"
                        placeholder="Marie Dupont"
                        maxLength={100}
                        required
                        aria-invalid={fieldState.invalid}
                        className="text-base sm:text-sm"
                      />
                    </InputGroup>
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
              <Controller
                name="business"
                control={control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="contact-business">Votre activité</FieldLabel>
                    <InputGroup className="h-11">
                      <InputGroupAddon>
                        <Building2 aria-hidden="true" />
                      </InputGroupAddon>
                      <InputGroupInput
                        {...field}
                        id="contact-business"
                        autoComplete="organization"
                        placeholder="Maison Luma"
                        maxLength={150}
                        required
                        aria-invalid={fieldState.invalid}
                        className="text-base sm:text-sm"
                      />
                    </InputGroup>
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
            </div>

            <Controller
              name="message"
              control={control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="contact-message">Votre besoin</FieldLabel>
                  <InputGroup>
                    <InputGroupTextarea
                      {...field}
                      id="contact-message"
                      rows={5}
                      maxLength={1500}
                      required
                      aria-invalid={fieldState.invalid}
                      aria-describedby="contact-message-help"
                      placeholder="Votre activité, les questions de vos clients, ce que vous aimeriez simplifier…"
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                          event.preventDefault();
                          event.currentTarget.form?.requestSubmit();
                        }
                      }}
                      className="min-h-32 text-base sm:text-sm"
                    />
                    <InputGroupAddon align="block-end" className="justify-between border-t">
                      <InputGroupText className="hidden text-xs sm:flex">
                        <Kbd>Ctrl</Kbd>
                        <Kbd>Entrée</Kbd>
                        pour ouvrir WhatsApp
                      </InputGroupText>
                      <InputGroupText aria-hidden="true" className="ml-auto font-mono text-xs tabular-nums">
                        {field.value.length}/1 500
                      </InputGroupText>
                    </InputGroupAddon>
                  </InputGroup>
                  {fieldState.invalid ? (
                    <FieldError id="contact-message-help" errors={[fieldState.error]} />
                  ) : (
                    <FieldDescription id="contact-message-help">
                      Entre 10 et 1 500 caractères.
                    </FieldDescription>
                  )}
                </Field>
              )}
            />

            {/* Below lg the phone preview is hidden: the exact text stays visible here. */}
            <div className="rounded-xl border bg-muted/40 p-3 lg:hidden">
              <p className="mb-2 font-mono text-[11px] tracking-widest text-muted-foreground uppercase">
                Aperçu du message
              </p>
              <div className="ml-auto max-w-[92%] rounded-2xl rounded-br-md bg-primary px-3 py-2 text-sm leading-snug text-primary-foreground">
                <Draft lines={draftLines(draft)} />
              </div>
            </div>

            <div className="space-y-3">
              <Button type="submit" size="lg" className="group h-12 w-full text-base sm:w-auto sm:px-5">
                <WhatsAppIcon aria-hidden="true" data-icon="inline-start" />
                Ouvrir mon message dans WhatsApp
                <ArrowRight
                  aria-hidden="true"
                  data-icon="inline-end"
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </Button>
              <p className="flex items-start gap-2 text-xs text-muted-foreground">
                <ShieldCheck aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  Ce formulaire n’enregistre rien : il prépare seulement votre message.{" "}
                  <Link href="/donneesEtConfidentialite" className="underline underline-offset-4">
                    Confidentialité
                  </Link>
                </span>
              </p>
            </div>
          </FieldGroup>
        </form>
      </div>

      <aside
        aria-label="Aperçu WhatsApp"
        className="relative hidden border-l bg-muted/30 lg:col-span-5 lg:block"
      >
        <div className="sticky top-16 flex h-[calc(100dvh-4rem)] items-center justify-center px-6 py-6">
          <MessagePreview values={draft} sent={sent} />
        </div>
      </aside>
    </section>
  );
}
