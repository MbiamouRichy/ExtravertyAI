"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleAlert,
  CreditCard,
  FolderPen,
  Loader2,
  LockKeyhole,
  MessageSquare,
  Smartphone,
  Sparkles,
} from "lucide-react";

import { createProjectAndCheckout } from "@/app/actions/stripe-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: 29,
    messages: "1 000",
    description: "Pour démarrer votre automatisation.",
  },
  {
    id: "business",
    name: "Business",
    price: 79,
    messages: "5 000",
    description: "Pour accompagner votre croissance.",
  },
  {
    id: "pro",
    name: "Pro",
    price: 199,
    messages: "20 000",
    description: "Pour des besoins à plus grand volume.",
  },
] as const;

function normalizePhone(value: string) {
  return value.replace(/[\s()-]/g, "");
}

const formSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Utilisez au moins 3 caractères.")
    .max(80, "Utilisez au maximum 80 caractères."),
  numero: z
    .string()
    .trim()
    .max(32, "Ce numéro est trop long.")
    .refine(
      (value) => /^\+[1-9]\d{6,14}$/.test(normalizePhone(value)),
      "Ajoutez l’indicatif international, par exemple +33 6 12 34 56 78.",
    ),
  plan: z.enum(["starter", "business", "pro"]),
});

type FormValues = z.infer<typeof formSchema>;

const inputClassName =
  "h-12 w-full rounded-xl border border-input bg-background pl-11 pr-4 " +
  "text-base text-foreground shadow-sm outline-none transition-colors " +
  "placeholder:text-muted-foreground " +
  "hover:border-muted-foreground/50 " +
  "focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/30 " +
  "aria-[invalid=true]:border-destructive " +
  "aria-[invalid=true]:focus-visible:ring-destructive/20 " +
  "disabled:cursor-not-allowed disabled:opacity-60";

const cardClassName =
  "min-w-0 rounded-2xl border border-border bg-card shadow-sm";

export default function CreateProjectForm() {
  const [isBusy, setIsBusy] = useState(false);

  // Garde synchrone : bloque un second clic avant le prochain rendu.
  // L’idempotence réelle doit également être assurée côté serveur.
  const submissionLock = useRef(false);

  const {
    register,
    watch,
    handleSubmit,
    clearErrors,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    mode: "onTouched",
    reValidateMode: "onChange",
    defaultValues: {
      name: "",
      numero: "",
      // Choix initial le moins cher, sans pousser le forfait supérieur.
      plan: "starter",
    },
  });

  const selectedPlanId = watch("plan");
  const projectName = watch("name").trim();

  const selectedPlan =
    PLANS.find((plan) => plan.id === selectedPlanId) ?? PLANS[0];

  async function onSubmit(values: FormValues) {
    if (submissionLock.current) return;

    submissionLock.current = true;
    setIsBusy(true);
    clearErrors("root");

    try {
      const result = await createProjectAndCheckout({
        name: values.name,
        numero: normalizePhone(values.numero),
        plan: values.plan,
      });

      if (!result.success || !result.url) {
        setError("root.server", {
          type: "server",
          message:
            "Nous n’avons pas pu ouvrir le paiement. Vérifiez votre liste de projets avant de réessayer.",
        });

        submissionLock.current = false;
        setIsBusy(false);
        return;
      }

      const checkoutUrl = new URL(result.url);

      // Défense supplémentaire contre une redirection inattendue.
      // Si Stripe utilise un domaine personnalisé, ajoute-le explicitement.
      if (
        checkoutUrl.protocol !== "https:" ||
        checkoutUrl.hostname !== "checkout.stripe.com" ||
        checkoutUrl.port !== "" ||
        checkoutUrl.username !== "" ||
        checkoutUrl.password !== ""
      ) {
        throw new Error("Unexpected checkout destination");
      }

      window.location.assign(checkoutUrl.href);

      // On conserve l’état occupé jusqu’à la navigation :
      // pas de finally qui réactive le bouton trop tôt.
    } catch {
      // Ne pas afficher les exceptions internes Prisma / Stripe / Evolution.
      setError("root.server", {
        type: "server",
        message:
          "La connexion a été interrompue ou le paiement n’a pas pu être ouvert. Consultez vos projets avant de lancer une nouvelle tentative.",
      });

      submissionLock.current = false;
      setIsBusy(false);
    }
  }

  return (
    <div className="relative flex-1 isolate min-h-full">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute w-full inset-x-0 top-0 -z-10 h-80 bg-linear-to-b from-primary/5 to-transparent"
      />

      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
        <Link
          href="/projects"
          className="mb-7 inline-flex min-h-11 items-center gap-2 rounded-md text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Mes projets
        </Link>

        <header className="mb-8 max-w-2xl sm:mb-10">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-medium text-foreground">
            <Sparkles aria-hidden="true" className="size-3.5 text-primary" />
            Votre espace d’automatisation WhatsApp
          </div>

          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Donnez vie à votre prochain projet.
          </h1>

          <p className="mt-3 text-base leading-7 text-muted-foreground">
            Renseignez votre numéro WhatsApp, choisissez un forfait et
            poursuivez sur Stripe pour activer votre essai de 10 jours.
          </p>
        </header>

        <form
          noValidate
          aria-label="Créer un projet"
          aria-busy={isBusy}
          onSubmit={handleSubmit(onSubmit)}
          className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_370px] lg:gap-8"
        >
          <div className="min-w-0 space-y-6">
            <section
              aria-labelledby="project-details-title"
              className={cardClassName}
            >
              <div className="flex items-start gap-3 border-b border-border p-5 sm:p-6">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-sm font-semibold">
                  <span className="sr-only">Étape </span>1
                </span>

                <div>
                  <h2
                    id="project-details-title"
                    className="font-semibold tracking-tight text-foreground"
                  >
                    Configurez votre projet
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Donnez-lui un nom et associez votre numéro.
                  </p>
                </div>
              </div>

              <fieldset
                disabled={isBusy}
                className="min-w-0 space-y-6 p-5 sm:p-6"
              >
                <legend className="sr-only">Informations du projet</legend>

                <p className="text-xs text-muted-foreground">
                  Tous les champs sont obligatoires.
                </p>

                <div className="space-y-2">
                  <label
                    htmlFor="project-name"
                    className="block text-sm font-medium"
                  >
                    Nom du projet
                  </label>

                  <div className="relative">
                    <FolderPen
                      aria-hidden="true"
                      className="pointer-events-none absolute left-3.5 top-4 size-4 text-muted-foreground"
                    />

                    <Input
                      {...register("name")}
                      id="project-name"
                      type="text"
                      autoComplete="off"
                      maxLength={80}
                      required
                      placeholder="Ex. Service client — Maison Luma"
                      aria-invalid={Boolean(errors.name)}
                      aria-describedby={
                        errors.name
                          ? "project-name-help project-name-error"
                          : "project-name-help"
                      }
                      className={inputClassName}
                    />
                  </div>

                  <p
                    id="project-name-help"
                    className="text-xs leading-5 text-muted-foreground"
                  >
                    Un nom facile à retrouver dans votre tableau de bord.
                  </p>

                  {errors.name && (
                    <p
                      id="project-name-error"
                      className="text-sm text-destructive"
                    >
                      {errors.name.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="project-phone"
                    className="block text-sm font-medium"
                  >
                    Numéro WhatsApp
                  </label>

                  <div className="relative">
                    <Smartphone
                      aria-hidden="true"
                      className="pointer-events-none absolute left-3.5 top-4 size-4 text-muted-foreground"
                    />

                    <Input
                      {...register("numero")}
                      id="project-phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      maxLength={32}
                      required
                      placeholder="+33 6 12 34 56 78"
                      aria-invalid={Boolean(errors.numero)}
                      aria-describedby={
                        errors.numero
                          ? "project-phone-help project-phone-error"
                          : "project-phone-help"
                      }
                      className={inputClassName}
                    />
                  </div>

                  <p
                    id="project-phone-help"
                    className="text-xs leading-5 text-muted-foreground"
                  >
                    Utilisez un numéro que vous êtes autorisé à connecter, avec
                    son indicatif pays. Les espaces sont acceptés.
                  </p>

                  {errors.numero && (
                    <p
                      id="project-phone-error"
                      className="text-sm text-destructive"
                    >
                      {errors.numero.message}
                    </p>
                  )}
                </div>

                <div className="flex items-start gap-3 rounded-xl bg-muted/60 p-4">
                  <MessageSquare
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                  />
                  <p className="text-xs leading-5 text-muted-foreground">
                    La saisie du numéro ne connecte pas automatiquement votre
                    compte WhatsApp. Vous devrez ensuite finaliser son
                    association.
                  </p>
                </div>
              </fieldset>
            </section>

            <section
              aria-labelledby="project-plan-title"
              className={cardClassName}
            >
              <div className="flex items-start gap-3 border-b border-border p-5 sm:p-6">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-sm font-semibold">
                  <span className="sr-only">Étape </span>2
                </span>

                <div>
                  <h2
                    id="project-plan-title"
                    className="font-semibold tracking-tight"
                  >
                    Choisissez votre forfait
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Sélectionnez le volume adapté à votre activité.
                  </p>
                </div>
              </div>

              <fieldset
                disabled={isBusy}
                aria-describedby={
                  errors.plan ? "project-plan-error" : undefined
                }
                className="min-w-0 p-5 sm:p-6"
              >
                <legend className="sr-only">Forfait mensuel</legend>

                <div className="grid gap-3 sm:grid-cols-3">
                  {PLANS.map((plan) => (
                    <div key={plan.id} className="relative min-w-0">
                      <Input
                        {...register("plan")}
                        id={`plan-${plan.id}`}
                        type="radio"
                        value={plan.id}
                        aria-invalid={Boolean(errors.plan)}
                        className="peer sr-only"
                      />

                      <label
                        htmlFor={`plan-${plan.id}`}
                        className={[
                          "flex h-full cursor-pointer flex-col rounded-xl",
                          "border border-border bg-background p-4",
                          "transition-[border-color,background-color,box-shadow]",
                          "hover:border-primary/50",
                          "peer-checked:border-primary peer-checked:bg-primary/5",
                          "peer-checked:ring-1 peer-checked:ring-primary",
                          "peer-focus-visible:outline-2",
                          "peer-focus-visible:outline-offset-4",
                          "peer-focus-visible:outline-ring",
                          "peer-disabled:cursor-not-allowed peer-disabled:opacity-60",
                          "motion-reduce:transition-none",
                        ].join(" ")}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold">
                            {plan.name}
                          </span>

                          <span
                            aria-hidden="true"
                            className={
                              selectedPlanId === plan.id
                                ? "flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground"
                                : "size-5 rounded-full border border-input"
                            }
                          >
                            {selectedPlanId === plan.id && (
                              <Check className="size-3.5" />
                            )}
                          </span>
                        </span>

                        <span className="mt-5 flex flex-wrap items-baseline gap-1">
                          <span className="text-3xl font-semibold tracking-tight tabular-nums">
                            {plan.price} €
                          </span>
                          <span className="text-xs text-muted-foreground">
                            / mois
                          </span>
                        </span>

                        <span className="mt-2 text-xs leading-5 text-muted-foreground">
                          {plan.description}
                        </span>

                        <span className="mt-auto pt-5">
                          <span className="block border-t border-border pt-3 text-sm font-medium">
                            {plan.messages} messages
                          </span>
                          <span className="text-xs text-muted-foreground">
                            par mois
                          </span>
                        </span>
                      </label>
                    </div>
                  ))}
                </div>

                {errors.plan && (
                  <p
                    id="project-plan-error"
                    className="mt-3 text-sm text-destructive"
                  >
                    Sélectionnez un forfait.
                  </p>
                )}

                <p className="mt-4 text-xs leading-5 text-muted-foreground">
                  Tarifs mensuels après l’essai. Le montant et les conditions
                  applicables seront présentés sur Stripe avant confirmation.
                </p>
              </fieldset>
            </section>

            <div className="flex items-start gap-3 px-1 text-sm text-muted-foreground">
              <CreditCard
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0"
              />
              <p className="leading-6">
                <span className="font-medium text-foreground">
                  Prochaine étape : Stripe.
                </span>{" "}
                Une carte bancaire est demandée pour activer l’essai. Vous
                pourrez vérifier les conditions de l’abonnement avant de
                confirmer.
              </p>
            </div>
          </div>

          <aside
            aria-labelledby="project-summary-title"
            className="min-w-0 lg:sticky lg:top-16"
          >
            <div className="overflow-hidden rounded-2xl border border-primary/20 bg-card shadow-sm">
              <div className="border-b border-border bg-primary/5 p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <h2 id="project-summary-title" className="font-semibold">
                    Votre projet
                  </h2>
                  <span className="rounded-full border border-primary/20 bg-background px-2.5 py-1 text-xs font-medium">
                    Essai de 10 jours
                  </span>
                </div>

                <p className="mt-3 wrap-break-word text-sm text-muted-foreground">
                  {projectName || "Votre prochain projet WhatsApp"}
                </p>
              </div>

              <div className="space-y-5 p-5 sm:p-6">
                <dl className="space-y-4 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Forfait</dt>
                    <dd className="font-medium">{selectedPlan.name}</dd>
                  </div>

                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Volume mensuel</dt>
                    <dd className="text-right font-medium">
                      {selectedPlan.messages} messages
                    </dd>
                  </div>

                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Après l’essai</dt>
                    <dd className="text-right font-medium tabular-nums">
                      {selectedPlan.price} € / mois
                    </dd>
                  </div>
                </dl>

                <div className="border-t border-border pt-5">
                  <div className="flex items-end justify-between gap-4">
                    <span className="text-sm font-medium">
                      Abonnement pendant l’essai
                    </span>
                    <span className="whitespace-nowrap text-3xl font-semibold tracking-tight">
                      0 €
                    </span>
                  </div>

                  <p className="mt-3 text-xs leading-5 text-muted-foreground">
                    Ensuite, l’abonnement est renouvelé automatiquement au tarif
                    du forfait choisi, sauf résiliation avant la fin de l’essai.
                  </p>
                </div>

                {errors.root?.server && (
                  <div
                    role="alert"
                    className="rounded-xl border border-destructive/30 bg-destructive/5 p-4"
                  >
                    <div className="flex items-start gap-2">
                      <CircleAlert
                        aria-hidden="true"
                        className="mt-0.5 size-4 shrink-0 text-destructive"
                      />
                      <div className="space-y-2 text-sm">
                        <p className="font-medium text-foreground">
                          Impossible de poursuivre
                        </p>
                        <p className="leading-6 text-muted-foreground">
                          {errors.root.server.message}
                        </p>
                        <Link
                          href="/projects"
                          className="inline-flex min-h-11 items-center font-medium underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          Consulter mes projets
                        </Link>
                      </div>
                    </div>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={isBusy}
                  className="h-auto min-h-12 w-full gap-2 whitespace-normal rounded-xl px-4 py-3 text-sm font-semibold"
                >
                  {isBusy ? (
                    <>
                      <Loader2
                        aria-hidden="true"
                        className="size-4 shrink-0 animate-spin motion-reduce:animate-none"
                      />
                      Ouverture de Stripe…
                    </>
                  ) : (
                    <>
                      Continuer vers Stripe
                      <ArrowRight
                        aria-hidden="true"
                        className="size-4 shrink-0"
                      />
                    </>
                  )}
                </Button>

                <div
                  role="status"
                  aria-live="polite"
                  aria-atomic="true"
                  className="text-center text-xs leading-5 text-muted-foreground"
                >
                  {isBusy ? (
                    <p>
                      Préparation de votre projet. Gardez cette page ouverte.
                    </p>
                  ) : (
                    <p className="flex items-center justify-center gap-1.5">
                      <LockKeyhole
                        aria-hidden="true"
                        className="size-3.5 shrink-0"
                      />
                      Paiement géré par Stripe
                    </p>
                  )}
                </div>
              </div>
            </div>

            <p className="mt-4 px-2 text-center text-xs leading-5 text-muted-foreground">
              Vos coordonnées bancaires sont saisies sur Stripe, pas dans ce
              formulaire.
            </p>
          </aside>
        </form>
      </div>
    </div>
  );
}
