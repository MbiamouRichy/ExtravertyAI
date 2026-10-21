"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { getCountries, getCountryCallingCode } from "libphonenumber-js/max";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FolderPen,
  LockKeyhole,
  Pencil,
  QrCode,
  Sparkles,
  CreditCard,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ProjectCreationFormSchema,
  parseProjectPhone,
  type ProjectCreationFormValues,
} from "@/lib/project-creation-schema";
import {
  PRICING_PLANS as PLANS,
  PLAN_CAPABILITIES,
  formatMessageLimit,
  formatPlanPrice,
  type PlanId,
} from "@/lib/pricing";
import { cn } from "@/lib/utils";

import { AssistantPreview } from "./assistant-preview";

// Mêmes conditions d'essai que la page réelle (stripe-actions, billing-quota).
const TRIAL_DAYS = 10;
const TRIAL_MESSAGES = 150;

const countryNames = new Intl.DisplayNames(["fr"], { type: "region" });
const phoneCountries = getCountries()
  .map((code) => ({
    code,
    name: countryNames.of(code) ?? code,
    callingCode: getCountryCallingCode(code),
  }))
  .sort((a, b) => a.name.localeCompare(b.name, "fr"));

const STEPS = [
  { title: "Votre projet", fields: ["name", "country", "numero"] },
  { title: "Votre forfait", fields: ["plan"] },
  { title: "Vérification", fields: [] },
] as const;

/**
 * Proposition pour /projects/new : un assistant en trois étapes, une seule
 * décision à l'écran, et un aperçu en direct de ce que verront les clients.
 * Maquette : la validation est réelle, rien n'est envoyé.
 */
export function NewProjectWizard({ initialPlan = "starter" }: { initialPlan?: PlanId }) {
  const [step, setStep] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);

  const {
    control,
    trigger,
    setValue,
    watch,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<ProjectCreationFormValues>({
    resolver: zodResolver(ProjectCreationFormSchema),
    mode: "onTouched",
    reValidateMode: "onChange",
    defaultValues: { name: "", numero: "", country: "FR", plan: initialPlan },
  });

  const values = watch();
  const plan = PLANS.find((item) => item.id === values.plan) ?? PLANS[0];
  const phone = parseProjectPhone(values.numero, values.country);

  // Le focus suit l'étape pour les lecteurs d'écran et le clavier.
  useEffect(() => {
    if (moved.current) headingRef.current?.focus();
  }, [step]);

  function goTo(next: number) {
    moved.current = true;
    setStep(next);
  }

  async function next() {
    const valid = await trigger([...STEPS[step].fields], { shouldFocus: true });
    if (valid) goTo(step + 1);
  }

  async function onSubmit() {
    await new Promise((resolve) => setTimeout(resolve, 600));
    toast.info("Maquette : le paiement Stripe s’ouvrirait ici.", {
      description: "Aucune donnée n’a été envoyée.",
    });
  }

  const last = step === STEPS.length - 1;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-36 pt-6 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <Link
        href="/projects"
        className="-ml-1 inline-flex min-h-11 items-center gap-2 rounded-md px-1 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Mes projets
      </Link>

      <div className="mt-4 grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-14">
        <form
          noValidate
          aria-label="Créer un projet"
          aria-busy={isSubmitting}
          onSubmit={(event) => {
            event.preventDefault();
            if (last) void handleSubmit(onSubmit)(event);
            else void next();
          }}
          className="min-w-0"
        >
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Nouveau projet
          </p>

          <ol aria-label="Étapes" className="mt-4 grid grid-cols-3 gap-2">
            {STEPS.map((item, index) => (
              <li key={item.title} aria-current={index === step ? "step" : undefined}>
                <span
                  aria-hidden
                  className={cn(
                    "block h-1 rounded-full bg-border transition-colors motion-reduce:transition-none",
                    index <= step && "bg-foreground",
                  )}
                />
                <span
                  className={cn(
                    "mt-2 flex items-center gap-1.5 text-xs text-muted-foreground",
                    index === step && "font-medium text-foreground",
                  )}
                >
                  {index < step ? (
                    <Check aria-hidden className="size-3.5" strokeWidth={2.5} />
                  ) : (
                    <span className="tabular-nums">{index + 1}.</span>
                  )}
                  {item.title}
                  {index < step && <span className="sr-only"> (terminée)</span>}
                </span>
              </li>
            ))}
          </ol>

          <div aria-live="polite" className="sr-only">
            Étape {step + 1} sur {STEPS.length} : {STEPS[step].title}
          </div>

          <h1
            ref={headingRef}
            tabIndex={-1}
            className="mt-10 text-3xl outline-none sm:text-4xl"
          >
            {step === 0 && "Quel numéro votre assistant va-t-il gérer ?"}
            {step === 1 && "Choisissez le rythme qui vous convient"}
            {step === 2 && "Tout est prêt, vérifiez avant de continuer"}
          </h1>
          <p className="mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
            {step === 0 &&
              "Donnez un nom à votre projet et indiquez le numéro WhatsApp que l’IA prendra en charge."}
            {step === 1 &&
              `Les ${TRIAL_DAYS} premiers jours sont offerts sur tous les forfaits. Vous pourrez en changer à tout moment.`}
            {step === 2 &&
              "Rien n’est débité aujourd’hui. Vous connecterez WhatsApp juste après le paiement."}
          </p>

          <div className="mt-8">
            {step === 0 && (
              <FieldGroup className="gap-6">
                <Controller
                  name="name"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="maquette-project-name">Nom du projet</FieldLabel>
                      <InputGroup className="h-11">
                        <InputGroupAddon>
                          <FolderPen aria-hidden />
                        </InputGroupAddon>
                        <InputGroupInput
                          {...field}
                          onChange={(event) => {
                            field.onChange(event);
                            // trigger() ne marque pas le formulaire comme soumis :
                            // on revalide nous-mêmes pour effacer l'erreur dès la correction.
                            if (fieldState.invalid) void trigger("name");
                          }}
                          id="maquette-project-name"
                          autoComplete="off"
                          maxLength={80}
                          placeholder="Ex. Service client — Maison Luma"
                          aria-invalid={fieldState.invalid}
                          aria-describedby="maquette-project-name-help"
                          className="text-base sm:text-sm"
                        />
                      </InputGroup>
                      {fieldState.invalid ? (
                        <FieldError errors={[fieldState.error]} />
                      ) : (
                        <FieldDescription id="maquette-project-name-help">
                          Visible uniquement par votre équipe.
                        </FieldDescription>
                      )}
                    </Field>
                  )}
                />

                <div className="grid gap-6 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-4">
                  <Controller
                    name="country"
                    control={control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="maquette-project-country">Pays</FieldLabel>
                        <Select
                          name={field.name}
                          value={field.value}
                          onValueChange={(value) => {
                            field.onChange(value);
                            if (values.numero) void trigger("numero");
                          }}
                        >
                          <SelectTrigger
                            id="maquette-project-country"
                            ref={field.ref}
                            onBlur={field.onBlur}
                            aria-invalid={fieldState.invalid}
                            className="w-full min-w-0 data-[size=default]:h-11"
                          >
                            <SelectValue placeholder="Choisir un pays" />
                          </SelectTrigger>
                          <SelectContent position="popper" className="max-h-80">
                            {phoneCountries.map((country) => (
                              <SelectItem
                                key={country.code}
                                value={country.code}
                                textValue={`${country.name} ${country.code} +${country.callingCode}`}
                              >
                                <span className="truncate">{country.name}</span>
                                <span className="shrink-0 text-muted-foreground tabular-nums">
                                  +{country.callingCode}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                      </Field>
                    )}
                  />

                  <Controller
                    name="numero"
                    control={control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="maquette-project-phone">Numéro WhatsApp</FieldLabel>
                        <InputGroup className="h-11">
                          <InputGroupAddon>
                            <InputGroupText className="tabular-nums">
                              +{getCountryCallingCode(values.country)}
                            </InputGroupText>
                          </InputGroupAddon>
                          <InputGroupInput
                            {...field}
                            onChange={(event) => {
                              const value = event.target.value;
                              // Coller un numéro en +33… choisit le pays automatiquement.
                              const international = value.trim().startsWith("+")
                                ? parseProjectPhone(value)
                                : undefined;
                              if (international?.country) {
                                setValue("country", international.country, {
                                  shouldValidate: true,
                                  shouldDirty: true,
                                });
                                field.onChange(international.formatNational());
                              } else {
                                field.onChange(value);
                              }
                              if (fieldState.invalid) void trigger("numero");
                            }}
                            id="maquette-project-phone"
                            type="tel"
                            inputMode="tel"
                            autoComplete="tel-national"
                            maxLength={40}
                            placeholder={values.country === "FR" ? "06 12 34 56 78" : "Votre numéro"}
                            aria-invalid={fieldState.invalid}
                            aria-describedby="maquette-project-phone-help"
                            className="text-base tabular-nums sm:text-sm"
                          />
                        </InputGroup>
                        {fieldState.invalid ? (
                          <FieldError errors={[fieldState.error]} />
                        ) : (
                          <FieldDescription id="maquette-project-phone-help">
                            Un numéro que vous êtes autorisé à connecter.
                          </FieldDescription>
                        )}
                      </Field>
                    )}
                  />
                </div>
              </FieldGroup>
            )}

            {step === 1 && (
              <Controller
                name="plan"
                control={control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <RadioGroup
                      name={field.name}
                      value={field.value}
                      onValueChange={field.onChange}
                      aria-label="Forfait mensuel"
                      className="gap-3"
                    >
                      {PLANS.map((item) => {
                        const checked = field.value === item.id;
                        return (
                          <div
                            key={item.id}
                            className={cn(
                              "rounded-xl border bg-card transition-colors hover:border-foreground/30",
                              checked && "border-foreground ring-1 ring-foreground",
                              "has-[[role=radio]:focus-visible]:outline-2 has-[[role=radio]:focus-visible]:outline-offset-2 has-[[role=radio]:focus-visible]:outline-ring",
                            )}
                          >
                            <RadioGroupItem
                              ref={checked ? field.ref : undefined}
                              id={`maquette-plan-${item.id}`}
                              value={item.id}
                              className="peer sr-only"
                            />
                            <FieldLabel
                              htmlFor={`maquette-plan-${item.id}`}
                              className="flex w-full! cursor-pointer flex-col items-stretch gap-0 p-4 font-normal sm:p-5"
                            >
                              <span className="flex items-start justify-between gap-4">
                                <span className="min-w-0">
                                  <span className="flex flex-wrap items-center gap-2 text-base font-medium">
                                    {item.name}
                                    {item.highlighted && (
                                      <Badge variant="secondary" className="font-normal">
                                        Le plus choisi
                                      </Badge>
                                    )}
                                  </span>
                                  <span className="mt-1 block text-xs text-muted-foreground tabular-nums">
                                    {formatMessageLimit(item.messageLimit)} messages · {item.users} utilisateurs
                                  </span>
                                </span>
                                <span className="shrink-0 text-right">
                                  <span className="block text-xl font-semibold tracking-tight tabular-nums">
                                    {formatPlanPrice(item.priceCents)}
                                  </span>
                                  <span className="text-xs text-muted-foreground">par mois</span>
                                </span>
                              </span>
                              {checked && (
                                <ul
                                  aria-label={`Inclus dans ${item.name}`}
                                  className="mt-4 grid gap-2 border-t pt-4 sm:grid-cols-2"
                                >
                                  {PLAN_CAPABILITIES[item.id].map((feature) => (
                                    <li key={feature} className="flex items-start gap-2 text-xs leading-5">
                                      <Check aria-hidden className="mt-1 size-3 shrink-0" strokeWidth={2.5} />
                                      {feature}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </FieldLabel>
                          </div>
                        );
                      })}
                    </RadioGroup>
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
            )}

            {step === 2 && (
              <dl className="divide-y rounded-xl border bg-card text-sm">
                <ReviewRow label="Projet" value={values.name.trim()} onEdit={() => goTo(0)} editLabel="Modifier le projet" />
                <ReviewRow
                  label="Numéro WhatsApp"
                  value={phone?.formatInternational() ?? values.numero}
                  onEdit={() => goTo(0)}
                  editLabel="Modifier le numéro"
                />
                <ReviewRow
                  label="Forfait"
                  value={`${plan.name} · ${formatPlanPrice(plan.priceCents)} / mois`}
                  onEdit={() => goTo(1)}
                  editLabel="Changer de forfait"
                />
                <div className="flex items-baseline justify-between gap-4 p-4 sm:p-5">
                  <dt className="font-medium">À payer aujourd’hui</dt>
                  <dd className="text-right">
                    <span className="block text-2xl font-semibold tracking-tight tabular-nums">
                      {formatPlanPrice(0)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Essai {TRIAL_DAYS} jours · {TRIAL_MESSAGES} messages, puis{" "}
                      {formatPlanPrice(plan.priceCents)} / mois
                    </span>
                  </dd>
                </div>
              </dl>
            )}
          </div>

          {/* Mobile : l'action principale reste à portée de pouce. */}
          <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:static lg:mt-10 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
              <Button
                type="button"
                variant="ghost"
                size="lg"
                onClick={() => goTo(step - 1)}
                disabled={step === 0 || isSubmitting}
                className={cn(step === 0 && "invisible")}
              >
                <ArrowLeft data-icon="inline-start" />
                Retour
              </Button>
              <Button type="submit" size="lg" disabled={isSubmitting}>
                {isSubmitting ? (
                  "Ouverture de Stripe…"
                ) : last ? (
                  <>
                    <span className="sm:hidden">Continuer</span>
                    <span className="hidden sm:inline">Continuer vers le paiement</span>
                  </>
                ) : (
                  "Continuer"
                )}
                <ArrowRight data-icon="inline-end" />
              </Button>
            </div>
            {last && (
              <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground lg:justify-end">
                <LockKeyhole aria-hidden className="size-3.5 shrink-0" />
                Paiement sécurisé par Stripe. Votre carte n’est jamais saisie ici.
              </p>
            )}
          </div>
        </form>

        <aside aria-label="Aperçu et prochaines étapes" className="min-w-0 space-y-6 lg:sticky lg:top-10">
          <AssistantPreview
            projectName={values.name.trim()}
            phone={phone?.formatInternational()}
            planName={plan.name}
          />
          <section aria-labelledby="maquette-next-title" className="rounded-xl border p-5">
            <h2 id="maquette-next-title" className="text-sm! font-medium! tracking-normal!">
              Ce qui se passe ensuite
            </h2>
            <ol className="mt-4 space-y-4">
              {[
                { icon: CreditCard, title: "Paiement sécurisé", text: `0 € aujourd’hui, essai de ${TRIAL_DAYS} jours.` },
                { icon: QrCode, title: "Connexion WhatsApp", text: "Scannez un QR code depuis votre téléphone." },
                { icon: Sparkles, title: "L’IA répond", text: "Vos clients reçoivent une réponse en quelques secondes." },
              ].map(({ icon: Icon, title, text }, index) => (
                <li key={title} className="flex gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-background">
                    <Icon aria-hidden className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">
                      <span className="sr-only">{index + 1}. </span>
                      {title}
                    </span>
                    <span className="block text-xs leading-5 text-muted-foreground">{text}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}

function ReviewRow({
  label,
  value,
  onEdit,
  editLabel,
}: {
  label: string;
  value: string;
  onEdit: () => void;
  editLabel: string;
}) {
  return (
    <div className="p-4 sm:p-5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 flex items-center justify-between gap-4">
        <span className="min-w-0 truncate font-medium tabular-nums">{value}</span>
        <Button type="button" variant="ghost" size="icon-sm" onClick={onEdit} aria-label={editLabel} title={editLabel}>
          <Pencil />
        </Button>
      </dd>
    </div>
  );
}
