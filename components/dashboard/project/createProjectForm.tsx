"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { getCountries, getCountryCallingCode } from "libphonenumber-js/max";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleAlert,
  FolderPen,
  Info,
  Loader2,
  LockKeyhole,
} from "lucide-react";

import { createProjectAndCheckout } from "@/app/actions/stripe-actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  formatMessageLimit,
  formatPlanPrice,
  type PlanId,
} from "@/lib/pricing";
import { cn } from "@/lib/utils";

// Trial terms enforced server-side (stripe-actions trial_period_days, billing-quota).
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

const STEPS = ["Projet", "Forfait", "Paiement"] as const;

export default function CreateProjectForm({
  initialPlan = "starter",
}: {
  initialPlan?: PlanId;
}) {
  const [isBusy, setIsBusy] = useState(false);
  // Synchronous guard against a double click before the next render. The
  // server action must remain idempotent on its own.
  const submissionLock = useRef(false);

  const {
    control,
    trigger,
    setValue,
    watch,
    handleSubmit,
    clearErrors,
    setError,
    formState: { errors },
  } = useForm<ProjectCreationFormValues>({
    resolver: zodResolver(ProjectCreationFormSchema),
    mode: "onTouched",
    reValidateMode: "onChange",
    defaultValues: { name: "", numero: "", country: "FR", plan: initialPlan },
  });

  const selectedCountry = watch("country");
  const projectName = watch("name").trim();
  const selectedPlan =
    PLANS.find((plan) => plan.id === watch("plan")) ?? PLANS[0];
  const serverError = errors.root?.server?.message;

  async function onSubmit(values: ProjectCreationFormValues) {
    if (submissionLock.current) return;
    submissionLock.current = true;
    setIsBusy(true);
    clearErrors("root");

    const fail = (message: string) => {
      setError("root.server", { type: "server", message });
      submissionLock.current = false;
      setIsBusy(false);
    };

    try {
      const result = await createProjectAndCheckout({
        name: values.name,
        numero: parseProjectPhone(values.numero, values.country)!.number,
        plan: values.plan,
      });
      if (!result.success || !result.url) {
        fail(
          result.error ||
            "Nous n’avons pas pu ouvrir le paiement. Vérifiez votre liste de projets avant de réessayer.",
        );
        return;
      }

      // Only ever leave the app for Stripe Checkout.
      const checkoutUrl = new URL(result.url);
      if (
        checkoutUrl.protocol !== "https:" ||
        checkoutUrl.hostname !== "checkout.stripe.com" ||
        checkoutUrl.port ||
        checkoutUrl.username ||
        checkoutUrl.password
      ) {
        throw new Error("Unexpected checkout destination");
      }
      // Stay busy until the browser navigates away.
      window.location.assign(checkoutUrl.href);
    } catch {
      // Never surface internal Prisma / Stripe / Evolution errors.
      fail(
        "La connexion a été interrompue ou le paiement n’a pas pu être ouvert. Consultez vos projets avant de réessayer.",
      );
    }
  }

  const submitLabel = isBusy
    ? "Ouverture de Stripe…"
    : "Continuer vers le paiement";

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-36 pt-6 sm:px-6 sm:pt-8 lg:px-8 lg:pb-16 lg:pt-10">
      <Link
        href="/projects"
        className="-ml-1 inline-flex min-h-11 items-center gap-2 rounded-md px-1 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Mes projets
      </Link>

      <header className="mt-4 mb-8 sm:mb-10">
        <h1 className="text-2xl! font-semibold! leading-tight! tracking-tight! sm:text-3xl!">
          Créer un projet
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">
          Associez votre numéro WhatsApp et choisissez un forfait. Les{" "}
          {TRIAL_DAYS} premiers jours sont offerts.
        </p>
        <ol
          aria-label="Étapes"
          className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground"
        >
          {STEPS.map((step, index) => (
            <li key={step} className="flex items-center gap-3">
              <span className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex size-5 items-center justify-center rounded-full border text-[11px] font-medium tabular-nums",
                    index < 2 && "border-foreground/30 text-foreground",
                  )}
                >
                  {index + 1}
                </span>
                {step}
                {index === 2 && <span className="sr-only"> (sur Stripe)</span>}
              </span>
              {index < STEPS.length - 1 && (
                <span aria-hidden className="h-px w-6 bg-border" />
              )}
            </li>
          ))}
        </ol>
      </header>

      <form
        noValidate
        aria-label="Créer un projet"
        aria-busy={isBusy}
        onSubmit={handleSubmit(onSubmit)}
        className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-12"
      >
        <div className="min-w-0 space-y-10">
          {/* Step 1 — project */}
          <section aria-labelledby="step-project">
            <StepHeading
              id="step-project"
              index={1}
              title="Votre projet"
              description="Un nom pour le retrouver et le numéro WhatsApp à automatiser."
            />
            <fieldset disabled={isBusy} className="min-w-0">
              <legend className="sr-only">Informations du projet</legend>
              <FieldGroup className="gap-6">
                <Controller
                  name="name"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="project-name">
                        Nom du projet
                      </FieldLabel>
                      <InputGroup className="h-11">
                        <InputGroupAddon>
                          <FolderPen aria-hidden />
                        </InputGroupAddon>
                        <InputGroupInput
                          {...field}
                          id="project-name"
                          type="text"
                          autoComplete="off"
                          maxLength={80}
                          required
                          placeholder="Ex. Service client — Maison Luma"
                          aria-invalid={fieldState.invalid}
                          aria-describedby={
                            fieldState.invalid ? undefined : "project-name-help"
                          }
                          className="text-base sm:text-sm"
                        />
                      </InputGroup>
                      {fieldState.invalid ? (
                        <FieldError errors={[fieldState.error]} />
                      ) : (
                        <FieldDescription id="project-name-help">
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
                        <FieldLabel htmlFor="project-phone-country">
                          Pays
                        </FieldLabel>
                        <Select
                          name={field.name}
                          value={field.value}
                          disabled={isBusy}
                          onValueChange={(value) => {
                            field.onChange(value);
                            if (watch("numero")) void trigger("numero");
                          }}
                        >
                          <SelectTrigger
                            id="project-phone-country"
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
                        {fieldState.invalid && (
                          <FieldError errors={[fieldState.error]} />
                        )}
                      </Field>
                    )}
                  />

                  <Controller
                    name="numero"
                    control={control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="project-phone">
                          Numéro WhatsApp
                        </FieldLabel>
                        <InputGroup className="h-11">
                          <InputGroupAddon>
                            <InputGroupText className="tabular-nums">
                              +{getCountryCallingCode(selectedCountry)}
                            </InputGroupText>
                          </InputGroupAddon>
                          <InputGroupInput
                            {...field}
                            onChange={(event) => {
                              const value = event.target.value;
                              // Pasting +33… switches the country automatically.
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
                            }}
                            id="project-phone"
                            type="tel"
                            inputMode="tel"
                            autoComplete="tel-national"
                            maxLength={40}
                            required
                            placeholder={
                              selectedCountry === "FR"
                                ? "06 12 34 56 78"
                                : "Votre numéro"
                            }
                            aria-invalid={fieldState.invalid}
                            aria-describedby="project-phone-help"
                            className="text-base tabular-nums sm:text-sm"
                          />
                        </InputGroup>
                        {fieldState.invalid && (
                          <FieldError errors={[fieldState.error]} />
                        )}
                      </Field>
                    )}
                  />
                </div>

                <FieldDescription
                  id="project-phone-help"
                  className="-mt-3 flex gap-2 text-xs"
                >
                  <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                  Utilisez un numéro que vous êtes autorisé à connecter. Vous
                  l’associerez à WhatsApp après le paiement.
                </FieldDescription>
              </FieldGroup>
            </fieldset>
          </section>

          {/* Step 2 — plan */}
          <section aria-labelledby="step-plan">
            <StepHeading
              id="step-plan"
              index={2}
              title="Votre forfait"
              description={`Gratuit pendant ${TRIAL_DAYS} jours, puis facturé chaque mois. Changez-en à tout moment.`}
            />
            <fieldset disabled={isBusy} className="min-w-0">
              <legend className="sr-only">Forfait mensuel</legend>
              <Controller
                name="plan"
                control={control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <RadioGroup
                      name={field.name}
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={isBusy}
                      aria-labelledby="step-plan"
                      aria-invalid={fieldState.invalid}
                      className="grid gap-3 md:grid-cols-3"
                    >
                      {PLANS.map((plan) => {
                        const checked = field.value === plan.id;
                        return (
                          <div key={plan.id} className="relative min-w-0">
                            <RadioGroupItem
                              ref={checked ? field.ref : undefined}
                              id={`plan-${plan.id}`}
                              value={plan.id}
                              className="peer sr-only"
                            />
                            <FieldLabel
                              htmlFor={`plan-${plan.id}`}
                              className={cn(
                                "flex h-full cursor-pointer flex-col items-stretch gap-0 rounded-xl border bg-card p-4 font-normal transition-colors",
                                "hover:border-foreground/30",
                                "peer-data-[state=checked]:border-foreground peer-data-[state=checked]:ring-1 peer-data-[state=checked]:ring-foreground",
                                "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring",
                                "peer-disabled:cursor-not-allowed peer-disabled:opacity-60",
                              )}
                            >
                              <span className="flex items-center justify-between gap-2">
                                <span className="flex items-center gap-2 text-sm font-medium">
                                  {plan.name}
                                  {plan.highlighted && (
                                    <Badge
                                      variant="secondary"
                                      className="font-normal"
                                    >
                                      Populaire
                                    </Badge>
                                  )}
                                </span>
                                <span
                                  aria-hidden
                                  className={cn(
                                    "flex size-4.5 shrink-0 items-center justify-center rounded-full border transition-colors",
                                    checked &&
                                      "border-foreground bg-foreground text-background",
                                  )}
                                >
                                  {checked && (
                                    <Check className="size-3" strokeWidth={3} />
                                  )}
                                </span>
                              </span>

                              <span className="mt-3 flex items-baseline gap-1">
                                <span className="text-2xl font-semibold tracking-tight tabular-nums">
                                  {formatPlanPrice(plan.priceCents)}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  / mois
                                </span>
                              </span>
                              <span className="mt-1 text-xs text-muted-foreground tabular-nums">
                                {formatMessageLimit(plan.messageLimit)} messages
                                · {plan.users} utilisateurs
                              </span>
                              <span className="mt-3 text-xs leading-5 text-muted-foreground">
                                {plan.description}
                              </span>
                            </FieldLabel>
                          </div>
                        );
                      })}
                    </RadioGroup>
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
            </fieldset>
          </section>

          {serverError && (
            <ServerError message={serverError} className="lg:hidden" />
          )}
        </div>

        {/* Summary: sticky sidebar on large screens, recap card on mobile. */}
        <aside
          aria-labelledby="summary-title"
          className="min-w-0 lg:sticky lg:top-20"
        >
          <div className="rounded-xl border bg-card">
            <div className="p-5">
              <h2
                id="summary-title"
                className="text-sm! font-medium! tracking-normal! text-muted-foreground"
              >
                Récapitulatif
              </h2>
              <p
                className="mt-1 truncate font-medium"
                title={projectName || undefined}
              >
                {projectName || "Nouveau projet"}
              </p>
            </div>
            <dl className="space-y-3 border-t p-5 text-sm">
              <SummaryRow label="Forfait" value={selectedPlan.name} />
              <SummaryRow
                label="Messages / mois"
                value={formatMessageLimit(selectedPlan.messageLimit)}
              />
              <SummaryRow
                label="Essai gratuit"
                value={`${TRIAL_DAYS} jours · ${TRIAL_MESSAGES} messages`}
              />
            </dl>
            <div className="space-y-1 border-t p-5">
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-sm font-medium">À payer aujourd’hui</span>
                <span className="text-2xl font-semibold tracking-tight tabular-nums">
                  {formatPlanPrice(0)}
                </span>
              </div>
              <p className="text-xs leading-5 text-muted-foreground">
                Puis {formatPlanPrice(selectedPlan.priceCents)} / mois, sans
                engagement. Résiliable avant la fin de l’essai.
              </p>
            </div>

            <div className="hidden space-y-3 border-t p-5 lg:block">
              {serverError && <ServerError message={serverError} />}
              <Button
                type="submit"
                size="lg"
                disabled={isBusy}
                className="w-full"
              >
                <SubmitContent busy={isBusy} label={submitLabel} />
              </Button>
              <SecureNote busy={isBusy} />
            </div>
          </div>
        </aside>

        {/* Mobile / tablet: the primary action stays within thumb reach. */}
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:hidden">
          <div className="mx-auto flex max-w-5xl items-center gap-4">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {selectedPlan.name} · {formatPlanPrice(0)} aujourd’hui
              </p>
              <p className="truncate text-xs text-muted-foreground">
                puis {formatPlanPrice(selectedPlan.priceCents)} / mois
              </p>
            </div>
            <Button
              type="submit"
              size="lg"
              disabled={isBusy}
              className="shrink-0"
            >
              <SubmitContent
                busy={isBusy}
                label={isBusy ? "Ouverture…" : "Continuer"}
              />
            </Button>
          </div>
          <SecureNote busy={isBusy} className="mt-2" />
        </div>
      </form>
    </div>
  );
}

function StepHeading({
  id,
  index,
  title,
  description,
}: {
  id: string;
  index: number;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-5">
      <p className="text-xs font-medium text-muted-foreground tabular-nums">
        Étape {index} sur 2
      </p>
      <h2
        id={id}
        className="mt-1 text-lg! font-semibold! leading-snug! tracking-tight!"
      >
        {title}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium tabular-nums">{value}</dd>
    </div>
  );
}

function SubmitContent({ busy, label }: { busy: boolean; label: string }) {
  return busy ? (
    <>
      <Loader2
        aria-hidden
        className="animate-spin motion-reduce:animate-none"
      />
      {label}
    </>
  ) : (
    <>
      {label}
      <ArrowRight aria-hidden data-icon="inline-end" />
    </>
  );
}

function SecureNote({
  busy,
  className,
}: {
  busy: boolean;
  className?: string;
}) {
  return (
    <p
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground",
        className,
      )}
    >
      {busy ? (
        "Préparation de votre projet. Gardez cette page ouverte."
      ) : (
        <>
          <LockKeyhole aria-hidden className="size-3.5 shrink-0" />
          Paiement sécurisé par Stripe. Votre carte n’est jamais saisie ici.
        </>
      )}
    </p>
  );
}

function ServerError({
  message,
  className,
}: {
  message: string;
  className?: string;
}) {
  return (
    <Alert variant="destructive" className={className}>
      <CircleAlert aria-hidden />
      <AlertTitle>Impossible de poursuivre</AlertTitle>
      <AlertDescription>
        <p>{message}</p>
        <Link
          href="/projects"
          className="mt-1 inline-flex font-medium underline underline-offset-4"
        >
          Consulter mes projets
        </Link>
      </AlertDescription>
    </Alert>
  );
}
