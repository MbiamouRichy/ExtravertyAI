"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  FormProvider,
  useForm,
  useWatch,
  type FieldErrors,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, m, type Variants } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CreditCard,
  Loader2,
  MessagesSquare,
  Rocket,
  RotateCcw,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  EASE_OUT,
  MotionProvider,
  SPRING,
  usePrefersReducedMotion,
} from "@/components/website/vitrine/motion";
import { parseProjectPhone } from "@/lib/project-creation-schema";

import { AgentPersonalityStep } from "./agent-personality-step";
import { TRIAL_DAYS, WIZARD_STEPS, type WizardStep, type WizardStepId } from "./data";
import { createUrlSource } from "./knowledge-sources";
import { LaunchReviewStep } from "./launch-review-step";
import type { PreviewInput } from "./preview-script";
import { ProjectEssentialsStep } from "./project-essentials-step";
import {
  ProjectWizardSchema,
  STEP_FIELDS,
  WIZARD_DEFAULTS,
  type ProjectWizardValues,
} from "./schema";
import {
  WIZARD_ASIDE,
  WIZARD_ASIDE_INNER,
  WIZARD_GRID,
  WIZARD_MAIN,
  WizardIntro,
} from "./wizard-chrome";
import { WizardStepper } from "./wizard-stepper";
import { WhatsAppConnectionStep } from "./whatsapp-connection-step";
import { WhatsAppLivePreview } from "./whatsapp-live-preview";

// Maquette : le lancement est simulé localement, sans action serveur.
const LAUNCH_STAGES = [
  "Création du projet…",
  "Indexation des sources…",
  "Activation de l’agent…",
] as const;
const STAGE_MS = 700;

const STEP_VARIANTS: Variants = {
  enter: (direction: number) => ({ opacity: 0, x: direction * 28 }),
  center: { opacity: 1, x: 0 },
  exit: (direction: number) => ({ opacity: 0, x: direction * -28 }),
};

type Phase = "editing" | "launching" | "done";

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function ProjectWizard() {
  return (
    <MotionProvider>
      <Wizard />
    </MotionProvider>
  );
}

function Wizard() {
  const form = useForm<ProjectWizardValues>({
    resolver: zodResolver(ProjectWizardSchema),
    mode: "onTouched",
    reValidateMode: "onChange",
    defaultValues: WIZARD_DEFAULTS,
  });
  const {
    control,
    trigger,
    getValues,
    setValue,
    setError,
    setFocus,
    handleSubmit,
    reset,
    formState: { isDirty },
  } = form;

  const [step, setStep] = useState(0);
  const [reached, setReached] = useState(0);
  const [direction, setDirection] = useState(1);
  const [navigated, setNavigated] = useState(false);
  const [phase, setPhase] = useState<Phase>("editing");
  const [stage, setStage] = useState(0);
  const [connectedNumber, setConnectedNumber] = useState<string | null>(null);
  const [launchedName, setLaunchedName] = useState("");
  const topRef = useRef<HTMLDivElement>(null);
  const mounted = useRef(true);
  const reduce = usePrefersReducedMotion();

  const busy = phase === "launching";
  const current = WIZARD_STEPS[step];
  const isLast = step === WIZARD_STEPS.length - 1;

  const [
    name,
    description,
    language,
    agentName,
    tone,
    useEmojis,
    humanHandover,
    sources,
    numero,
    country,
  ] = useWatch({
    control,
    name: [
      "name",
      "description",
      "language",
      "agentName",
      "tone",
      "useEmojis",
      "humanHandover",
      "sources",
      "numero",
      "country",
    ],
  });
  const phone = parseProjectPhone(numero, country);
  const connected = phone !== undefined && phone.number === connectedNumber;
  const previewInput: PreviewInput = {
    name,
    description,
    language,
    agentName,
    tone,
    useEmojis,
    humanHandover,
    sourceLabels: sources.map((source) => source.label),
  };

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Warn before leaving with unsaved answers.
  useEffect(() => {
    if (!isDirty || phase === "done") return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty, phase]);

  function goTo(index: number) {
    setDirection(index >= step ? 1 : -1);
    setStep(index);
    setReached((value) => Math.max(value, index));
    setNavigated(true);
    topRef.current?.scrollIntoView({
      block: "start",
      behavior: reduce ? "auto" : "smooth",
    });
  }

  function editStep(id: WizardStepId) {
    goTo(WIZARD_STEPS.findIndex((item) => item.id === id));
  }

  async function goNext() {
    if (current.id === "agent") {
      // A typed but not yet added page is clearly meant to be imported.
      const pending = getValues("sourceUrl").trim();
      if (pending) {
        const result = createUrlSource(pending, getValues("sources"));
        if (!result.ok) {
          setError("sourceUrl", { type: "manual", message: result.message });
          setFocus("sourceUrl");
          return;
        }
        setValue("sources", [...getValues("sources"), result.source], {
          shouldDirty: true,
        });
        setValue("sourceUrl", "");
      }
    }
    const valid = await trigger([...STEP_FIELDS[current.id]], {
      shouldFocus: true,
    });
    if (valid) goTo(step + 1);
  }

  async function launch(values: ProjectWizardValues) {
    setPhase("launching");
    for (let index = 0; index < LAUNCH_STAGES.length; index += 1) {
      setStage(index);
      await wait(STAGE_MS);
      if (!mounted.current) return;
    }
    setLaunchedName(values.name);
    setPhase("done");
    toast.success("Projet configuré", {
      description: "Maquette : aucune donnée n’a quitté votre navigateur.",
    });
  }

  function onInvalid(errors: FieldErrors<ProjectWizardValues>) {
    const index = WIZARD_STEPS.findIndex((item) =>
      STEP_FIELDS[item.id].some((field) => field in errors),
    );
    if (index >= 0 && index !== step) goTo(index);
    toast.error("Une information est à corriger avant le lancement.");
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    // Enter in a field moves forward; only the last step launches.
    if (!isLast) {
      void goNext();
      return;
    }
    void handleSubmit(launch, onInvalid)(event);
  }

  function startOver() {
    reset(WIZARD_DEFAULTS);
    setConnectedNumber(null);
    setStage(0);
    setPhase("editing");
    setReached(0);
    goTo(0);
  }

  const preview = (
    <WhatsAppLivePreview input={previewInput} connected={connected} />
  );

  return (
    <div className={WIZARD_GRID}>
      <main className={WIZARD_MAIN}>
        <div ref={topRef} aria-hidden="true" className="scroll-mt-20" />
        <WizardIntro />
        <WizardStepper
          current={phase === "done" ? WIZARD_STEPS.length : step}
          reached={reached}
          disabled={phase !== "editing"}
          onSelect={goTo}
        />

        {phase === "done" ? (
          <LaunchSuccess
            name={launchedName}
            connected={connected}
            onStartOver={startOver}
          />
        ) : (
          <FormProvider {...form}>
            <form
              noValidate
              aria-busy={busy}
              aria-labelledby={`step-${current.id}-title`}
              onSubmit={onSubmit}
            >
              <AnimatePresence mode="wait" initial={false} custom={direction}>
                <m.section
                  key={current.id}
                  custom={direction}
                  variants={STEP_VARIANTS}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.32, ease: EASE_OUT }}
                  aria-labelledby={`step-${current.id}-title`}
                >
                  <StepHeading step={current} index={step} autoFocus={navigated} />
                  <fieldset disabled={busy} className="min-w-0">
                    <legend className="sr-only">{current.title}</legend>
                    {current.id === "essentials" && <ProjectEssentialsStep />}
                    {current.id === "whatsapp" && (
                      <WhatsAppConnectionStep
                        connectedNumber={connectedNumber}
                        onConnectedChange={setConnectedNumber}
                      />
                    )}
                    {current.id === "agent" && <AgentPersonalityStep />}
                    {current.id === "launch" && (
                      <LaunchReviewStep connected={connected} onEdit={editStep} />
                    )}
                  </fieldset>
                </m.section>
              </AnimatePresence>

              <WizardActions
                step={step}
                isLast={isLast}
                busy={busy}
                stageLabel={LAUNCH_STAGES[stage]}
                onBack={() => goTo(step - 1)}
                preview={preview}
              />
            </form>
          </FormProvider>
        )}
      </main>

      <aside aria-label="Aperçu WhatsApp" className={WIZARD_ASIDE}>
        <div className={WIZARD_ASIDE_INNER}>{preview}</div>
      </aside>
    </div>
  );
}

function StepHeading({
  step,
  index,
  autoFocus,
}: {
  step: WizardStep;
  index: number;
  autoFocus: boolean;
}) {
  const ref = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    // Moves screen readers and keyboard users to the new step, not on first load.
    if (autoFocus) ref.current?.focus({ preventScroll: true });
  }, [autoFocus]);

  return (
    <div className="mb-8">
      <p className="font-mono text-xs text-muted-foreground tabular-nums">
        Étape {index + 1} sur {WIZARD_STEPS.length}
      </p>
      <h2
        ref={ref}
        id={`step-${step.id}-title`}
        tabIndex={-1}
        className="mt-2 text-2xl tracking-tight outline-none sm:text-3xl"
      >
        {step.title}
      </h2>
      <p className="mt-2 max-w-xl text-sm text-muted-foreground">
        {step.description}
      </p>
    </div>
  );
}

function SubmitContent({ busy, isLast }: { busy: boolean; isLast: boolean }) {
  if (busy) {
    return (
      <>
        <Loader2 aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
        Lancement…
      </>
    );
  }
  if (isLast) {
    return (
      <>
        <Rocket aria-hidden="true" data-icon="inline-start" />
        Lancer l’agent
      </>
    );
  }
  return (
    <>
      Continuer
      <ArrowRight aria-hidden="true" data-icon="inline-end" />
    </>
  );
}

function WizardActions({
  step,
  isLast,
  busy,
  stageLabel,
  onBack,
  preview,
}: {
  step: number;
  isLast: boolean;
  busy: boolean;
  stageLabel: string;
  onBack: () => void;
  preview: ReactNode;
}) {
  return (
    <>
      <p role="status" aria-live="polite" className="sr-only">
        {busy ? stageLabel : ""}
      </p>

      <div className="mt-12 hidden items-center gap-3 border-t pt-6 lg:flex">
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={busy}
          onClick={onBack}
          className={cn(step === 0 && "invisible")}
        >
          <ArrowLeft aria-hidden="true" data-icon="inline-start" />
          Retour
        </Button>
        <AnimatePresence mode="wait" initial={false}>
          <m.p
            key={busy ? stageLabel : "idle"}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
            aria-hidden="true"
            className={cn(
              "ml-auto font-mono text-[11px] text-muted-foreground",
              busy && "ai-thinking-shimmer",
            )}
          >
            {busy
              ? stageLabel
              : isLast
                ? `${TRIAL_DAYS} jours offerts ensuite`
                : `Étape ${step + 1} sur ${WIZARD_STEPS.length}`}
          </m.p>
        </AnimatePresence>
        <Button type="submit" size="lg" disabled={busy} className="min-w-40">
          <SubmitContent busy={busy} isLast={isLast} />
        </Button>
      </div>

      {/* Mobile and tablet: actions stay within thumb reach. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur supports-backdrop-filter:bg-background/80 lg:hidden">
        <div className="mx-auto flex max-w-2xl items-center gap-2">
          <Drawer>
            <DrawerTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon-lg"
                aria-label="Voir l’aperçu WhatsApp"
              >
                <Smartphone />
              </Button>
            </DrawerTrigger>
            <DrawerContent className="data-[vaul-drawer-direction=bottom]:max-h-[94dvh]">
              <DrawerHeader className="sr-only">
                <DrawerTitle>Aperçu en direct</DrawerTitle>
                <DrawerDescription>
                  Ce que vos clients verront sur WhatsApp.
                </DrawerDescription>
              </DrawerHeader>
              <div className="overflow-y-auto px-4 pt-4 pb-6">{preview}</div>
            </DrawerContent>
          </Drawer>
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            disabled={busy || step === 0}
            onClick={onBack}
            aria-label="Étape précédente"
          >
            <ArrowLeft />
          </Button>
          <Button type="submit" size="lg" disabled={busy} className="flex-1">
            <SubmitContent busy={busy} isLast={isLast} />
          </Button>
        </div>
      </div>
    </>
  );
}

function LaunchSuccess({
  name,
  connected,
  onStartOver,
}: {
  name: string;
  connected: boolean;
  onStartOver: () => void;
}) {
  const ref = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);

  return (
    <m.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE_OUT }}
      aria-labelledby="launch-done-title"
      className="relative overflow-hidden rounded-2xl border bg-card p-6 sm:p-10"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,color-mix(in_oklch,var(--foreground)_6%,transparent),transparent_60%)]"
      />
      <div className="relative">
        <m.span
          initial={{ scale: 0.5, rotate: -12 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={SPRING}
          className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground"
        >
          <Check aria-hidden="true" className="size-7" strokeWidth={2.5} />
        </m.span>
        <p className="mt-6 font-mono text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
          Projet configuré
        </p>
        <h2
          ref={ref}
          id="launch-done-title"
          tabIndex={-1}
          className="mt-2 text-3xl text-balance tracking-tight outline-none sm:text-4xl"
        >
          « {name} » est prêt à répondre.
        </h2>
        <p className="mt-3 max-w-lg text-sm text-muted-foreground">
          Il ne reste qu’à choisir votre forfait, avec {TRIAL_DAYS} jours offerts
          {connected
            ? ". Votre numéro est déjà lié : l’agent répondra dès l’activation."
            : ", puis à lier votre numéro WhatsApp depuis votre téléphone."}
        </p>
        <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button asChild size="lg">
            <Link href="/maquettes/tarifs">
              <CreditCard data-icon="inline-start" />
              Choisir mon forfait
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/maquettes/projects/demo/chat">
              <MessagesSquare data-icon="inline-start" />
              Voir la messagerie de démo
            </Link>
          </Button>
          <Button type="button" variant="ghost" size="lg" onClick={onStartOver}>
            <RotateCcw data-icon="inline-start" />
            Recommencer
          </Button>
        </div>
        <p className="mt-8 font-mono text-[11px] text-muted-foreground">
          Maquette : aucune donnée n’a été envoyée.
        </p>
      </div>
    </m.section>
  );
}
