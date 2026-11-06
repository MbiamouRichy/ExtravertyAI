import { Skeleton } from "@/components/ui/skeleton";
import { PageLoading } from "@/components/page-loading";

// Miroir de la page Profil : mêmes requêtes de conteneur pour la carte
// d’identité, mêmes lignes empilées sur mobile (texte puis bouton pleine
// largeur) et mêmes boîtes de ligne (paragraphes en leading-relaxed).

/** Reprend SettingsSection : titre et description, puis le contenu (côte à côte dès md). */
function SectionSkeleton({
  title,
  lines,
  children,
}: {
  title: string;
  lines: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-4 border-t pt-8 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] md:gap-10">
      <div>
        <div className="flex h-6 items-center gap-2">
          <Skeleton className="size-4 rounded-sm" />
          <Skeleton className={`h-4 ${title}`} />
        </div>
        <div className="mt-1">
          {lines.map((width, index) => (
            <div key={index} className="flex h-5.5 items-center">
              <Skeleton className={`h-3.5 ${width}`} />
            </div>
          ))}
        </div>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Ligne de sécurité : libellé, valeur, puis bouton (à droite dès sm). */
function SecurityRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center sm:gap-6 sm:p-5">
      <div className="min-w-0 flex-1">
        <div className="flex h-5.5 items-center gap-2">
          <Skeleton className="size-4 rounded-sm" />
          <Skeleton className={`h-3.5 ${label}`} />
        </div>
        <div className="mt-1 flex h-5.5 items-center">
          <Skeleton className={`h-3.5 max-w-full ${value}`} />
        </div>
      </div>
      <Skeleton className="h-10 w-full shrink-0 rounded-md sm:h-8 sm:w-44" />
    </div>
  );
}

/** Ligne de session : icône et appareil, puis lieu, date et bouton. */
function SessionRow({ current = false }: { current?: boolean }) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 px-4 py-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-x-4 sm:px-5">
      <Skeleton className="size-9 shrink-0 rounded-full sm:row-span-2" />
      <div className="flex min-w-0 items-center gap-2 sm:self-end">
        <Skeleton className="h-3.5 w-44 max-w-full" />
        {current && <Skeleton className="h-5 w-16 shrink-0 rounded-full" />}
      </div>
      <div className="col-span-2 mt-2 flex h-5 items-center sm:col-span-1 sm:col-start-2 sm:mt-0.5 sm:self-start">
        <Skeleton className="h-3 w-52 max-w-full" />
      </div>
      <Skeleton className="col-span-2 mt-3 h-10 rounded-md sm:col-span-1 sm:col-start-3 sm:row-span-2 sm:row-start-1 sm:mt-0 sm:h-8 sm:w-32" />
    </div>
  );
}

export default function UserLoading() {
  return (
    <PageLoading
      label="Chargement du profil…"
      className="mx-auto w-full max-w-5xl p-4 sm:p-6 xl:p-8"
    >
      <div className="space-y-10">
        <header>
          <div className="flex h-5 items-center">
            <Skeleton className="h-3 w-16" />
          </div>
          <div className="mt-1 flex h-8 items-center md:h-9.5">
            <Skeleton className="h-7 w-48 md:h-8 md:w-56" />
          </div>
          <div className="mt-2">
            <div className="flex h-5.5 items-center">
              <Skeleton className="h-3.5 w-full max-w-xl" />
            </div>
            <div className="flex h-5.5 items-center md:hidden">
              <Skeleton className="h-3.5 w-full" />
            </div>
            <div className="flex h-5.5 items-center sm:hidden">
              <Skeleton className="h-3.5 w-1/2" />
            </div>
          </div>
        </header>

        <div className="@container/identity relative isolate overflow-hidden rounded-3xl border bg-card p-4 sm:p-6">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(var(--border)_1px,transparent_1px)] mask-[radial-gradient(ellipse_at_top_left,black,transparent_60%)] bg-size-[18px_18px]" />
          <div className="flex flex-col gap-5 @3xl/identity:flex-row @3xl/identity:items-center @3xl/identity:justify-between">
            <div className="flex min-w-0 flex-1 flex-col items-start gap-3 @xs/identity:flex-row @xs/identity:items-center @xs/identity:gap-4">
              <Skeleton className="size-14 shrink-0 rounded-full @xs/identity:size-16 @lg/identity:size-20" />
              <div className="w-full min-w-0">
                <div className="flex h-7 items-center @lg/identity:h-8">
                  <Skeleton className="h-5 w-40 max-w-full @lg/identity:h-6" />
                </div>
                <div className="flex h-5.5 items-center">
                  <Skeleton className="h-3.5 w-52 max-w-full" />
                </div>
                <Skeleton className="mt-2 h-5 w-24 rounded-full" />
              </div>
            </div>
            <div className="grid shrink-0 gap-2 @md/identity:grid-cols-2 @3xl/identity:flex">
              <Skeleton className="h-10 w-full rounded-md @3xl/identity:h-9 @3xl/identity:w-44" />
              <Skeleton className="h-10 w-full rounded-md @3xl/identity:h-9 @3xl/identity:w-40" />
            </div>
          </div>
        </div>

        <SectionSkeleton title="w-44" lines={["w-full", "w-full", "w-1/2"]}>
          <div className="divide-y rounded-2xl border bg-card">
            <SecurityRow label="w-28" value="w-52" />
            <SecurityRow label="w-24" value="w-60" />
          </div>
        </SectionSkeleton>

        <SectionSkeleton title="w-40" lines={["w-full", "w-full", "w-2/3"]}>
          <div className="overflow-hidden rounded-2xl border bg-card">
            <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:p-5">
              <div className="min-w-0 flex-1">
                <div className="flex h-5 items-center">
                  <Skeleton className="h-3 w-full max-w-72" />
                </div>
                <div className="flex h-5 items-center sm:hidden">
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </div>
              <Skeleton className="h-10 w-full shrink-0 rounded-md sm:h-9 sm:w-64" />
            </div>
            <div className="divide-y">
              <SessionRow current />
              <SessionRow />
            </div>
          </div>
        </SectionSkeleton>

        <SectionSkeleton title="w-28" lines={["w-full", "w-3/4"]}>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="rounded-2xl border bg-card p-1.5 sm:p-2">
                <Skeleton className="h-16 rounded-xl sm:h-20" />
                <div className="mt-2 flex h-4.5 items-center justify-center sm:h-5.5">
                  <Skeleton className="h-3 w-12" />
                </div>
              </div>
            ))}
          </div>
        </SectionSkeleton>

        <SectionSkeleton title="w-32" lines={["w-48"]}>
          <div className="flex flex-col justify-between gap-4 rounded-2xl border border-destructive/30 bg-card p-4 sm:flex-row sm:items-center sm:gap-6 sm:p-5">
            <div className="min-w-0 flex-1">
              <div className="flex h-5.5 items-center">
                <Skeleton className="h-3.5 w-40" />
              </div>
              <div className="mt-1">
                {["w-full", "w-full", "w-full", "w-2/3"].map((width, index) => (
                  <div key={index} className="flex h-5.5 items-center">
                    <Skeleton className={`h-3.5 ${width}`} />
                  </div>
                ))}
              </div>
            </div>
            <Skeleton className="h-10 w-full shrink-0 rounded-md sm:h-9 sm:w-52" />
          </div>
        </SectionSkeleton>
      </div>
    </PageLoading>
  );
}
