import { Skeleton } from "@/components/ui/skeleton";
import { PageLoading } from "@/components/page-loading";

// Miroir de « Équipe et accès » : mêmes grilles, marges et hauteurs de ligne
// que TeamManagement, pour que rien ne bouge à l’arrivée des données.

/** Six rôles : largeur du nom, puis longueur de la description. */
const ROLES = [
  { name: "w-24", lines: ["w-full", "w-2/3"] },
  { name: "w-28", lines: ["w-full", "w-3/4"] },
  { name: "w-20", lines: ["w-full", "w-5/6"] },
  { name: "w-14", lines: ["w-full", "w-1/2"] },
  { name: "w-16", lines: ["w-full", "w-2/3"] },
  { name: "w-24", lines: ["w-full", "w-3/5"] },
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
            <Skeleton className="h-3 w-14" />
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
              <Skeleton className={`mt-3 h-4 ${name}`} />
              <div className="mt-2 space-y-1.5">
                {lines.map((width) => (
                  <Skeleton key={width} className={`h-3 ${width}`} />
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
              <div
                key={index}
                className="flex items-start gap-3 px-4 py-3.5 sm:items-center sm:px-5"
              >
                <Skeleton className="size-10 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1">
                  <Skeleton className={`h-4 max-w-full ${name}`} />
                  <Skeleton className={`mt-1.5 h-3 max-w-full ${email}`} />
                  {/* Mobile : rôle et présence sous l’e-mail. */}
                  <div className="mt-2 flex items-center gap-2.5">
                    <Skeleton className="h-5 w-20 rounded-full sm:hidden" />
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  {assignable && (
                    <Skeleton className="mt-2.5 h-8 w-24 rounded-md sm:hidden" />
                  )}
                </div>
                <div className="hidden shrink-0 items-center gap-2 sm:flex">
                  <Skeleton className="h-5 w-24 rounded-full" />
                  {assignable && <Skeleton className="h-8 w-24 rounded-md" />}
                  <Skeleton className="size-8 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageLoading>
  );
}
