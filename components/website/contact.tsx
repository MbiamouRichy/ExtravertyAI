"use client";

import Link from "next/link";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  Loader2,
  Mail,
  Phone,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import { cn } from "@/lib/utils";
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
} from "@/components/ui/input-group";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { WhatsAppIcon } from "@/components/social-icon";

const WHATSAPP_NUMBER = "24176205629";
const EMAIL = "extravertyai@gmail.com";

const needs = [
  { value: "discover", label: "Découvrir la solution" },
  { value: "automate", label: "Automatiser mon activité" },
  { value: "help", label: "Obtenir de l’aide" },
] as const;

const formSchema = z.object({
  need: z.enum(["discover", "automate", "help"]),
  name: z.string().trim().min(2, "Indiquez votre nom.").max(100, "100 caractères maximum."),
  business: z
    .string()
    .trim()
    .min(2, "Indiquez le nom de votre activité.")
    .max(150, "150 caractères maximum."),
  message: z
    .string()
    .trim()
    .min(10, "Décrivez votre besoin en quelques mots (10 caractères minimum).")
    .max(1500, "1 500 caractères maximum."),
});

type FormValues = z.infer<typeof formSchema>;

const channels = [
  {
    icon: WhatsAppIcon,
    label: "WhatsApp",
    value: "+241 76 20 56 29",
    href: `https://wa.me/${WHATSAPP_NUMBER}`,
    external: true,
  },
  { icon: Phone, label: "Téléphone", value: "+241 76 20 56 29", href: "tel:+24176205629" },
  { icon: Mail, label: "E-mail", value: EMAIL, href: `mailto:${EMAIL}` },
];

const nextSteps = [
  { title: "Vous relisez", text: "Votre message s’ouvre dans WhatsApp, prêt à être envoyé." },
  { title: "Nous répondons", text: "Un membre de l’équipe vous répond directement sur WhatsApp." },
  { title: "On avance ensemble", text: "Démo, configuration ou aide : nous partons de votre quotidien." },
];

export function Contact() {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    mode: "onTouched",
    defaultValues: { need: "discover", name: "", business: "", message: "" },
  });

  function onSubmit(values: FormValues) {
    const need = needs.find((item) => item.value === values.need)?.label ?? "";
    const text = `Bonjour ExtravertyAI !\nJe m'appelle ${values.name}, de ${values.business}.\nMon besoin : ${need}.\n${values.message}`;
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (!opened) window.location.assign(url);
    toast.success("Votre message est prêt dans WhatsApp", {
      description: "Relisez-le, puis envoyez-le depuis WhatsApp.",
    });
    form.reset();
  }

  const submitting = form.formState.isSubmitting;

  return (
    <main id="contenu" className="overflow-x-clip">
      <section
        aria-labelledby="contact-title"
        className="relative isolate px-4 pb-16 pt-14 sm:px-6 md:pt-20"
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[radial-gradient(var(--border)_1px,transparent_1px)] mask-[radial-gradient(ellipse_70%_60%_at_30%_0%,black,transparent)] bg-size-[22px_22px]"
        />
        <div className="mx-auto grid w-full max-w-6xl gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
          <div className="lg:pt-6">
            <p className="mb-4 font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Contact
            </p>
            <h1
              id="contact-title"
              className="text-[2.6rem] text-balance sm:text-5xl md:text-6xl"
            >
              Une conversation.
              <span className="block text-muted-foreground">De nouvelles possibilités.</span>
            </h1>
            <p className="mt-6 max-w-md text-pretty text-muted-foreground md:text-lg">
              Racontez-nous votre quotidien sur WhatsApp. Nous vous aidons à
              voir ce que l’automatisation peut changer, sans engagement.
            </p>

            <ul className="mt-10 space-y-2">
              {channels.map(({ icon: Icon, label, value, href, external }) => (
                <li key={label}>
                  <a
                    href={href}
                    {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    className="group flex items-center gap-4 rounded-xl border bg-card p-4 outline-none transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-background">
                      <Icon aria-hidden="true" className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs text-muted-foreground">{label}</span>
                      <span className="block truncate text-sm font-medium">{value}</span>
                    </span>
                    <ArrowUpRight
                      aria-hidden="true"
                      className="size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                    />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <section
            aria-labelledby="form-title"
            className="self-start rounded-3xl border bg-card p-6 shadow-xl shadow-foreground/5 sm:p-8"
          >
            <div className="mb-8 flex items-start justify-between gap-4">
              <div>
                <h2 id="form-title" className="text-2xl tracking-tight">
                  Préparer mon message
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Vous le relirez avant de l’envoyer vous-même dans WhatsApp.
                </p>
              </div>
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <WhatsAppIcon aria-hidden="true" className="size-5" />
              </span>
            </div>

            <form noValidate aria-busy={submitting} onSubmit={form.handleSubmit(onSubmit)}>
              <FieldGroup className="gap-6">
                <Controller
                  name="need"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <FieldSet data-invalid={fieldState.invalid}>
                      <FieldLegend variant="label">Je souhaite…</FieldLegend>
                      <RadioGroup
                        name={field.name}
                        value={field.value}
                        onValueChange={field.onChange}
                        className="flex flex-wrap gap-2"
                      >
                        {needs.map((need) => {
                          const checked = field.value === need.value;
                          return (
                            <FieldLabel
                              key={need.value}
                              htmlFor={`need-${need.value}`}
                              className={cn(
                                "w-auto! cursor-pointer rounded-full border px-4 py-2 text-sm font-normal transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                                checked
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "hover:bg-muted",
                              )}
                            >
                              <RadioGroupItem
                                id={`need-${need.value}`}
                                value={need.value}
                                className="sr-only"
                              />
                              {need.label}
                            </FieldLabel>
                          );
                        })}
                      </RadioGroup>
                    </FieldSet>
                  )}
                />

                <div className="grid gap-6 sm:grid-cols-2">
                  <Controller
                    name="name"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="contact-name">Votre nom</FieldLabel>
                        <InputGroup>
                          <InputGroupInput
                            {...field}
                            id="contact-name"
                            autoComplete="name"
                            placeholder="Marie Dupont"
                            maxLength={100}
                            aria-invalid={fieldState.invalid}
                          />
                          <InputGroupAddon align="inline-start">
                            <UserRound />
                          </InputGroupAddon>
                        </InputGroup>
                        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                      </Field>
                    )}
                  />
                  <Controller
                    name="business"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="contact-business">Votre entreprise</FieldLabel>
                        <InputGroup>
                          <InputGroupInput
                            {...field}
                            id="contact-business"
                            autoComplete="organization"
                            placeholder="Nom de votre activité"
                            maxLength={150}
                            aria-invalid={fieldState.invalid}
                          />
                          <InputGroupAddon align="inline-start">
                            <Building2 />
                          </InputGroupAddon>
                        </InputGroup>
                        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                      </Field>
                    )}
                  />
                </div>

                <Controller
                  name="message"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="contact-message">Votre besoin</FieldLabel>
                      <Textarea
                        {...field}
                        id="contact-message"
                        rows={4}
                        maxLength={1500}
                        aria-invalid={fieldState.invalid}
                        aria-describedby="contact-message-help"
                        placeholder="Votre activité, les questions de vos clients, ce que vous aimeriez simplifier…"
                        className="min-h-28 resize-y"
                      />
                      <FieldDescription id="contact-message-help">
                        {field.value.length} / 1 500 caractères
                      </FieldDescription>
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />

                <Button type="submit" size="lg" className="w-full" disabled={submitting}>
                  {submitting ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
                  Ouvrir mon message dans WhatsApp
                  <ArrowRight data-icon="inline-end" />
                </Button>
                <p className="flex items-start gap-2 text-xs text-muted-foreground">
                  <ShieldCheck aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                  <span>
                    Ce formulaire n’enregistre rien : il prépare seulement votre
                    message.{" "}
                    <Link href="/donneesEtConfidentialite" className="underline underline-offset-4">
                      Confidentialité
                    </Link>
                  </span>
                </p>
              </FieldGroup>
            </form>
          </section>
        </div>
      </section>

      <section aria-labelledby="ensuite" className="border-y bg-muted/30 px-4 py-16 sm:px-6">
        <div className="mx-auto w-full max-w-6xl">
          <h2 id="ensuite" className="mb-8 text-2xl tracking-tight">
            Et ensuite ?
          </h2>
          <ol className="grid gap-4 md:grid-cols-3">
            {nextSteps.map((step, index) => (
              <li key={step.title} className="rounded-2xl border bg-background p-6">
                <span className="font-mono text-xs text-muted-foreground">0{index + 1}</span>
                <p className="mt-6 font-heading text-lg font-semibold">{step.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-label="Raccourcis" className="px-4 py-16 sm:px-6">
        <div className="mx-auto grid w-full max-w-6xl gap-4 sm:grid-cols-2">
          {[
            { label: "Déjà client ?", title: "Accéder à mon espace", href: "/projects" },
            { label: "Avant de commencer", title: "Lire les questions fréquentes", href: "/#faq" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group flex items-center justify-between rounded-2xl border p-6 outline-none transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span>
                <span className="block text-xs text-muted-foreground">{item.label}</span>
                <span className="mt-1 block font-heading text-lg font-semibold">{item.title}</span>
              </span>
              <ArrowUpRight
                aria-hidden="true"
                className="size-5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              />
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
