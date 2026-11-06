import { Skeleton } from "@/components/ui/skeleton";
import { PageLoading } from "@/components/page-loading";

// Miroir de « Équipe et accès » : mêmes grilles, marges et hauteurs de ligne
// que TeamManagement, pour que rien ne bouge à l’arrivée des données.

/** Six rôles : largeur du nom, puis longueur de la description. */
const ROLES = [
  { name: "w-24", lines: ["w-full", "w-2/3"] },
  { name: "w-28", lines: ["w-full", "w-3/4"] },
  { name: "w-20", lines: ["w-full", "w-11/12", "w-1/3"] },
  { name: "w-14", lines: ["w-full", "w-1/2"] },
  { name: "w-16", lines: ["w-full", "w-5/6", "w-1/3"] },
  { name: "w-24", lines: ["w-full", "w-4/5", "w-2/5"] },
];

/** Le propriétaire n’a pas de bouton « Assigner », les suivants si. */
const MEMBERS = [
  { name: "w-32", email: "w-48", assignable: false },
  { name: "w-40", email: "w-44", assignable: true },
  { name: "w-28", email: "w-52", assignable: true },
];

export default function TeamLoading() {
  return (
    <PageLoading
      label="Chargement de l’équipe…"
      className="mx-auto w-full max-w-5xl p-4 sm:p-6 xl:p-8"
    >
      <div className="space-y-8">
        <header className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div className="w-full min-w-0 max-w-xl sm:w-auto sm:flex-1">
            <div className="flex h-4 items-center">
              <Skeleton className="h-3 w-14" />
            </div>
            <Skeleton className="mt-2 h-9 w-60 max-w-full md:h-10 md:w-72" />
            <Skeleton className="mt-3 h-3.5 w-full max-w-md" />
            <Skeleton className="mt-2 h-3.5 w-2/3" />
          </div>
          <Skeleton className="h-9 w-full shrink-0 rounded-md sm:w-44" />
        </header>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ROLES.map(({ name, lines }, index) => (
            <div key={index} className="rounded-2xl border bg-card p-4">
              <div className="flex items-center justify-between">
                <Skeleton className="size-8 rounded-lg" />
                <Skeleton className="h-7 w-5" />
              </div>
              <div className="mt-3 flex h-5 items-center">
                <Skeleton className={`h-4 ${name}`} />
              </div>
              {/* Lignes de 20 px, comme les descriptions réelles. */}
              <div className="mt-0.5">
                {lines.map((width) => (
                  <div key={width} className="flex h-5 items-center">
                    <Skeleton className={`h-3 ${width}`} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="overflow-hidden rounded-2xl border bg-card">
          <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-3 w-52 max-w-full" />
            </div>
            <Skeleton className="h-9 w-full rounded-md sm:max-w-64" />
          </div>

          <div className="divide-y">
            {MEMBERS.map(({ name, email, assignable }, index) => (
              // Même grille que la ligne réelle : avatar, nom et menu en tête
              // sur mobile, puis e-mail, rôle et action sur toute la largeur.
              <div
                key={index}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-3.5 sm:flex sm:px-5"
              >
                <Skeleton className="size-9 shrink-0 rounded-full sm:size-10" />
                <div className="min-w-0 flex-1 max-sm:contents">
                  <div className="flex h-5 items-center">
                    <Skeleton className={`h-3.5 max-w-full ${name}`} />
                  </div>
                  <div className="flex h-5 items-center max-sm:col-span-3 max-sm:mt-2.5">
                    <Skeleton className={`h-3 max-w-full ${email}`} />
                  </div>
                  <div className="mt-1.5 flex items-center gap-2.5 max-sm:col-span-3 sm:mt-0.5">
                    <Skeleton className="h-5 w-20 rounded-full sm:hidden" />
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  {assignable && (
                    <Skeleton className="col-span-3 mt-2.5 h-8 rounded-md sm:hidden" />
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2 max-sm:col-start-3 max-sm:row-start-1">
                  <Skeleton className="hidden h-5 w-24 rounded-full sm:block" />
                  {assignable && <Skeleton className="hidden h-8 w-24 rounded-md sm:block" />}
                  <Skeleton className={`size-8 rounded-md ${assignable ? "" : "max-sm:hidden"}`} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageLoading>
  );
}
