import { Skeleton } from "@/components/ui/skeleton";

/** Squelette du panneau sombre AuthShowcase (mêmes marges et proportions). */
export function AuthShowcaseSkeleton() {
  return (
    <div className="relative isolate hidden overflow-hidden bg-primary p-12 lg:flex lg:flex-col lg:justify-between">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(var(--primary-foreground)_1px,transparent_1px)] opacity-10 mask-[radial-gradient(ellipse_at_top_right,black,transparent_70%)] bg-size-[20px_20px]" />
      <Skeleton className="h-3 w-40 bg-primary-foreground/15" />
      <div className="mx-auto w-full max-w-md space-y-3">
        {[0, 1, 2].map((index) => (
          <div key={index} className="flex items-center gap-4 rounded-2xl bg-primary-foreground/10 p-4">
            <Skeleton className="size-10 shrink-0 rounded-xl bg-primary-foreground/20" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-4/5 bg-primary-foreground/15" />
              <Skeleton className="h-3 w-1/3 bg-primary-foreground/10" />
            </div>
          </div>
        ))}
      </div>
      <div className="max-w-md space-y-2.5">
        <Skeleton className="h-6 w-full bg-primary-foreground/15" />
        <Skeleton className="h-6 w-3/4 bg-primary-foreground/15" />
      </div>
    </div>
  );
}

/** Ligne logo + bouton « Accueil » en haut de la colonne formulaire. */
export function AuthTopBarSkeleton() {
  return (
    <div className="flex h-8 items-center justify-between">
      <div className="flex items-center gap-1.5">
        <Skeleton className="size-6 rounded-md" />
        <Skeleton className="h-5 w-28" />
      </div>
      <Skeleton className="h-8 w-24 rounded-md" />
    </div>
  );
}

/** Champ de formulaire : libellé + InputGroup, mêmes hauteurs que Field. */
export function AuthFieldSkeleton({
  labelWidth = "w-24",
  withAside = false,
}: {
  labelWidth?: string;
  withAside?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-[1.203125rem] items-center justify-between">
        <Skeleton className={`h-3.5 ${labelWidth}`} />
        {withAside && <Skeleton className="h-3 w-28" />}
      </div>
      <div className="flex h-9 items-center gap-2 rounded-md border px-3">
        <Skeleton className="size-4 rounded-sm" />
        <Skeleton className="h-3 w-40 max-w-[60%]" />
      </div>
    </div>
  );
}

/** Boutons Google et TikTok, empilés avec l’écart réel de SignInSocialButton. */
export function AuthSocialSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {[0, 1].map((index) => (
        <div key={index} className="flex h-9 items-center justify-center gap-2 rounded-md border">
          <Skeleton className="size-4 rounded-full" />
          <Skeleton className="h-3.5 w-40 max-w-[60%]" />
        </div>
      ))}
    </div>
  );
}

/** Séparateur « ou » entre les connexions sociales et l’e-mail. */
export function AuthDividerSkeleton({ labelWidth = "w-24" }: { labelWidth?: string }) {
  return (
    <div className="flex h-4 items-center gap-2">
      <div className="h-px flex-1 bg-border" />
      <Skeleton className={`h-3 ${labelWidth}`} />
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}
