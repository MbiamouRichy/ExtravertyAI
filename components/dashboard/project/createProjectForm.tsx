"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { getCountries, getCountryCallingCode } from "libphonenumber-js/max";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  CircleAlert,
  Loader2,
} from "lucide-react";

import { createProjectAndCheckout } from "@/app/actions/stripe-actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Field,
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
import { Input } from "@/components/ui/input";
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

export default function CreateProjectForm({
  initialPlan = "starter",
}: {
  initialPlan?: PlanId;
}) {
  const [isBusy, setIsBusy] = useState(false);
  const [showFeatures, setShowFeatures] = useState(false);
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

  return (
    <div className="mx-auto w-full max-w-xl px-4 pt-6 pb-16 sm:px-6 sm:pt-10">
      <Link
        href="/projects"
        className="-ml-1 inline-flex min-h-11 items-center gap-2 rounded-md px-1 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Mes projets
      </Link>

      <header className="mt-4 mb-8">
        <h1 className="text-2xl! font-semibold! leading-tight! tracking-tight! sm:text-3xl!">
          Créer un projet
        </h1>
        <p className="mt-2 text-muted-foreground">
          {TRIAL_DAYS} jours offerts, sans engagement.
        </p>
      </header>

      <form
        noValidate
        aria-label="Créer un projet"
        aria-busy={isBusy}
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-8"
      >
        <fieldset disabled={isBusy} className="min-w-0">
          <legend className="sr-only">Informations du projet</legend>
          <FieldGroup className="gap-6">
            <Controller
              name="name"
              control={control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="project-name">Nom du projet</FieldLabel>
                  <Input
                    {...field}
                    id="project-name"
                    type="text"
                    autoComplete="off"
                    maxLength={80}
                    required
                    placeholder="Ex. Service client"
                    aria-invalid={fieldState.invalid}
                    className="h-11 text-base sm:text-sm"
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
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
                        {/* L’indicatif figure déjà dans le champ du numéro. */}
                        <SelectValue placeholder="Choisir un pays">
                          <CountryFlag code={field.value} />
                          <span className="truncate">
                            {countryNames.of(field.value) ?? field.value}
                          </span>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent
                        position="popper"
                        className="max-h-80 min-w-72"
                      >
                        {phoneCountries.map((country) => (
                          <SelectItem
                            key={country.code}
                            value={country.code}
                            textValue={`${country.name} ${country.code} +${country.callingCode}`}
                            className="min-h-10 *:[span]:last:w-full *:[span]:last:min-w-0"
                          >
                            <CountryFlag code={country.code} />
                            <span className="min-w-0 truncate">
                              {country.name}
                            </span>
                            <span className="ml-auto shrink-0 text-muted-foreground tabular-nums">
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
          </FieldGroup>
        </fieldset>

        <fieldset disabled={isBusy} className="min-w-0">
          <legend className="mb-3 text-sm font-medium">Forfait</legend>
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
                  aria-label="Forfait mensuel"
                  aria-invalid={fieldState.invalid}
                  className="gap-0 divide-y rounded-xl border"
                >
                  {PLANS.map((plan) => {
                    const checked = field.value === plan.id;
                    return (
                      <FieldLabel
                        key={plan.id}
                        htmlFor={`plan-${plan.id}`}
                        className={cn(
                          "flex w-full! cursor-pointer items-center gap-3 p-4 font-normal transition-colors first:rounded-t-xl last:rounded-b-xl hover:bg-muted/50",
                          checked && "bg-muted/50",
                        )}
                      >
                        <RadioGroupItem
                          ref={checked ? field.ref : undefined}
                          id={`plan-${plan.id}`}
                          value={plan.id}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2 text-sm font-medium">
                            {plan.name}
                            {plan.highlighted && (
                              <Badge variant="secondary" className="font-normal">
                                Populaire
                              </Badge>
                            )}
                          </span>
                          <span className="mt-0.5 block text-xs text-muted-foreground tabular-nums">
                            {formatMessageLimit(plan.messageLimit)} messages ·{" "}
                            {plan.users} membres
                          </span>
                        </span>
                        <span className="shrink-0 text-right text-sm font-medium tabular-nums">
                          {formatPlanPrice(plan.priceCents)}
                          <span className="block text-xs font-normal text-muted-foreground">
                            / mois
                          </span>
                        </span>
                      </FieldLabel>
                    );
                  })}
                </RadioGroup>
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-mx-2 mt-2 gap-1.5 px-2 text-muted-foreground hover:text-foreground"
            aria-expanded={showFeatures}
            aria-controls="plan-features"
            onClick={() => setShowFeatures((current) => !current)}
          >
            Inclus dans {selectedPlan.name}
            <ChevronDown
              data-icon="inline-end"
              className={cn(
                "transition-transform motion-reduce:transition-none",
                showFeatures && "rotate-180",
              )}
            />
          </Button>
          <ul
            id="plan-features"
            hidden={!showFeatures}
            aria-label={`Fonctionnalités du forfait ${selectedPlan.name}`}
            className="mt-2 grid gap-2 sm:grid-cols-2 sm:gap-x-6"
          >
            {PLAN_CAPABILITIES[selectedPlan.id].map((feature) => (
              <li
                key={feature}
                className="flex items-start gap-2 text-xs leading-5 text-muted-foreground"
              >
                <Check
                  aria-hidden="true"
                  className="mt-1 size-3 shrink-0 text-foreground"
                  strokeWidth={2.5}
                />
                {feature}
              </li>
            ))}
          </ul>
        </fieldset>

        <div className="space-y-4 border-t pt-6">
          <div>
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-sm font-medium">À payer aujourd’hui</span>
              <span className="text-2xl font-semibold tracking-tight tabular-nums">
                {formatPlanPrice(0)}
              </span>
            </div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Essai de {TRIAL_DAYS} jours limité à {TRIAL_MESSAGES} messages,
              puis {formatPlanPrice(selectedPlan.priceCents)} / mois. Résiliable
              avant la fin de l’essai.
            </p>
          </div>

          {serverError && <ServerError message={serverError} />}

          <Button
            type="submit"
            size="lg"
            disabled={isBusy}
            className="h-11 w-full"
          >
            {isBusy ? (
              <>
                <Loader2
                  aria-hidden
                  className="animate-spin motion-reduce:animate-none"
                />
                Ouverture du paiement…
              </>
            ) : (
              <>
                Continuer vers le paiement
                <ArrowRight aria-hidden data-icon="inline-end" />
              </>
            )}
          </Button>
          <p
            role="status"
            aria-live="polite"
            className="text-center text-xs text-muted-foreground empty:hidden"
          >
            {isBusy && "Gardez cette page ouverte."}
          </p>
        </div>
      </form>
    </div>
  );
}

// Fichiers locaux : Windows n’affiche pas les emojis de drapeaux.
function CountryFlag({ code }: { code: string }) {
  return (
    <Image
      src={`/flags/${code}.svg`}
      alt=""
      width={21}
      height={14}
      unoptimized
      className="h-3.5 w-[21px] shrink-0 rounded-xs object-cover ring-1 ring-border"
    />
  );
}

function ServerError({ message }: { message: string }) {
  return (
    <Alert variant="destructive">
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
