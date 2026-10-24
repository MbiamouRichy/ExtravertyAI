import { cn } from "@/lib/utils";
import { PageLoading } from "@/components/page-loading";
import { Skeleton } from "@/components/ui/skeleton";
import { WIZARD_STEPS } from "@/components/maquettes/project-new/data";
import {
  PhoneChatSkeleton,
  PhoneFrame,
} from "@/components/maquettes/project-new/phone-frame";
import {
  WIZARD_ASIDE,
  WIZARD_ASIDE_INNER,
  WIZARD_GRID,
  WIZARD_MAIN,
  WizardIntro,
} from "@/components/maquettes/project-new/wizard-chrome";

// Miroir de l’assistant tel qu’il s’ouvre : l’intro, les étapes et l’en-tête
// de la première étape sont déjà les vrais ; seuls les champs et l’aperçu
// WhatsApp attendent. Mêmes classes de grille : rien ne bouge à l’arrivée.

const FIRST_STEP = WIZARD_STEPS[0];

function FieldBone({
  label = "w-28",
  control = "h-11 w-full",
  help = "w-64",
}: {
  label?: string;
  control?: string;
  help?: string;
}) {
  return (
    <div className="space-y-3">
      <Skeleton className={cn("h-4", label)} />
      <Skeleton className={control} />
      <Skeleton className={cn("h-3 max-w-full", help)} />
    </div>
  );
}

export default function NewProjectLoading() {
  return (
    <PageLoading
      label="Préparation de l’assistant de création…"
      className="flex flex-1 flex-col"
    >
      <div className={WIZARD_GRID}>
        <div className={WIZARD_MAIN}>
          <WizardIntro />

          <ol className="mb-10 grid grid-cols-4 gap-2 sm:gap-3">
            {WIZARD_STEPS.map((step, index) => (
              <li key={step.id} className="flex min-w-0 flex-col gap-2.5 py-1.5">
                <span
                  className={cn(
                    "h-0.5 rounded-full",
                    index === 0 ? "bg-foreground" : "bg-border",
                  )}
                />
                <span
                  className={cn(
                    "flex min-w-0 items-center gap-1.5 font-mono text-[11px] tracking-wide",
                    index === 0 ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  <span className="tabular-nums">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className={cn("truncate uppercase", index > 0 && "max-sm:hidden")}>
                    {step.label}
                  </span>
                </span>
              </li>
            ))}
          </ol>

          <div className="mb-8">
            <p className="font-mono text-xs text-muted-foreground tabular-nums">
              Étape 1 sur {WIZARD_STEPS.length}
            </p>
            <p className="mt-2 font-heading text-2xl font-bold tracking-tight sm:text-3xl">
              {FIRST_STEP.title}
            </p>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              {FIRST_STEP.description}
            </p>
          </div>

          <div className="space-y-7">
            <FieldBone />
            <div className="space-y-3">
              <FieldBone label="w-52" control="h-38 w-full" help="w-80" />
              <div className="flex flex-wrap gap-1.5 pt-1">
                <Skeleton className="h-6 w-36" />
                <Skeleton className="h-6 w-28" />
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-6 w-24" />
              </div>
            </div>
            <FieldBone label="w-36" control="h-11 w-full sm:max-w-xs" help="w-72" />
          </div>

          <div className="mt-12 hidden items-center gap-3 border-t pt-6 lg:flex">
            <Skeleton className="ml-auto h-3 w-24" />
            <Skeleton className="h-10 w-40" />
          </div>
        </div>

        <div className={WIZARD_ASIDE}>
          <div className={WIZARD_ASIDE_INNER}>
            <div className="flex w-76 items-center justify-between">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3 w-16" />
            </div>

            <PhoneFrame>
              <PhoneChatSkeleton />
            </PhoneFrame>

            <div className="grid w-76 grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border">
              {[0, 1, 2, 3].map((fact) => (
                <div key={fact} className="space-y-1.5 bg-card px-3 py-2">
                  <Skeleton className="h-2.5 w-12" />
                  <Skeleton className="h-3 w-20" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
        <div className="mx-auto flex max-w-2xl items-center gap-2">
          <Skeleton className="size-10" />
          <Skeleton className="size-10" />
          <Skeleton className="h-10 flex-1" />
        </div>
      </div>
    </PageLoading>
  );
}
