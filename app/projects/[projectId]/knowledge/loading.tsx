import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { PageLoading } from "@/components/page-loading";

// Miroir d’Assistant IA tel qu’il s’ouvre : en-tête, onglets, puis
// « Personnalité & consignes » (trois sections, veille de l’IA, aperçu).

/** En-tête de section : icône et étiquette, puis titre et description. */
function SectionCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border bg-card p-5 sm:p-6">
      <div className="mb-6 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2">
        <Skeleton className="size-10 shrink-0 rounded-xl sm:row-span-3 sm:self-start" />
        <Skeleton className="h-3 w-28" />
        <Skeleton className="col-span-2 h-6 w-56 max-w-full sm:col-span-1 sm:col-start-2" />
        <Skeleton className="col-span-2 h-3.5 w-full max-w-sm sm:col-span-1 sm:col-start-2" />
      </div>
      {children}
    </div>
  );
}

function FieldLine({ label = "w-36", height = "h-11" }: { label?: string; height?: string }) {
  return (
    <div className="space-y-2">
      <Skeleton className={`h-4 ${label}`} />
      <Skeleton className={`${height} w-full rounded-md`} />
    </div>
  );
}

export default function AssistantLoading() {
  return (
    <PageLoading
      label="Chargement de l’assistant IA…"
      className="mx-auto w-full max-w-6xl p-4 sm:p-6 xl:p-8"
    >
      <div className="space-y-6">
        <header className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-9 w-56 max-w-full" />
          <div className="space-y-1.5 pt-1">
            <Skeleton className="h-3.5 w-full max-w-2xl" />
            <Skeleton className="h-3.5 w-80 max-w-full" />
          </div>
        </header>

        {/* Onglets : défilent horizontalement sur mobile */}
        <div className="-mx-4 overflow-hidden px-4 sm:mx-0 sm:px-0">
          <div className="flex w-max gap-1 rounded-lg bg-muted p-[3px]">
            {[44, 36, 24, 28, 28, 28].map((width, tab) => (
              <Skeleton
                key={tab}
                className={`h-[30px] rounded-md ${tab === 0 ? "bg-background" : "bg-muted-foreground/10"}`}
                style={{ width: `${width * 4}px` }}
              />
            ))}
          </div>
        </div>

        <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0 space-y-6">
            {/* 01 · Identité */}
            <SectionCard>
              <FieldLine />
            </SectionCard>

            {/* 02 · Mission & consignes */}
            <SectionCard>
              <div className="mb-5 space-y-3 rounded-xl border border-dashed p-4">
                <Skeleton className="h-4 w-56 max-w-full" />
                <div className="grid gap-2 sm:grid-cols-2">
                  {[0, 1, 2, 3].map((tip) => (
                    <Skeleton key={tip} className="h-3 w-4/5" />
                  ))}
                </div>
                <Skeleton className="h-3 w-full max-w-md" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-56 max-w-full" />
                <Skeleton className="h-32 w-full rounded-xl" />
                <Skeleton className="h-1 w-full rounded-full" />
                <Skeleton className="ml-auto h-3 w-20" />
              </div>
            </SectionCard>

            {/* 03 · Comportements */}
            <SectionCard>
              <div className="space-y-7">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-full max-w-md" />
                  <div className="grid gap-2 pt-1 sm:grid-cols-3">
                    {[0, 1, 2].map((tone) => (
                      <Skeleton key={tone} className="h-28 rounded-xl" />
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <div className="grid gap-2 sm:grid-cols-3">
                    {[0, 1, 2].map((length) => (
                      <Skeleton key={length} className="h-16 rounded-xl sm:h-20" />
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-9 w-full rounded-md sm:max-w-xs" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-28" />
                  <div className="divide-y rounded-xl border">
                    {[0, 1, 2, 3].map((behavior) => (
                      <div key={behavior} className="flex items-start justify-between gap-4 p-4">
                        <div className="min-w-0 flex-1 space-y-2">
                          <Skeleton className="h-4 w-40 max-w-full" />
                          <Skeleton className="h-3 w-full max-w-sm" />
                        </div>
                        <Skeleton className="h-5 w-9 shrink-0 rounded-full" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </SectionCard>

            {/* Mise en veille de l’IA */}
            <div className="rounded-2xl border bg-card p-4 sm:p-6">
              <Skeleton className="h-6 w-60 max-w-full" />
              <Skeleton className="mt-2 h-3.5 w-full max-w-md" />
              <div className="mt-5 flex items-start gap-4">
                <Skeleton className="size-9 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-52 max-w-full" />
                  <Skeleton className="h-3 w-full max-w-md" />
                </div>
                <Skeleton className="h-5 w-9 shrink-0 rounded-full" />
              </div>
            </div>
          </div>

          {/* Aperçu en direct (grands écrans) */}
          <aside className="hidden space-y-3 self-start rounded-2xl border bg-muted/40 p-4 2xl:block">
            <Skeleton className="h-3 w-28" />
            <div className="overflow-hidden rounded-2xl border bg-card">
              <div className="flex items-center gap-3 border-b px-4 py-3">
                <Skeleton className="size-9 rounded-full" />
                <div className="space-y-1.5">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
              <div className="space-y-2 p-4">
                <Skeleton className="h-8 w-20 rounded-2xl" />
                <Skeleton className="ml-6 h-24 rounded-2xl" />
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[20, 16, 28, 24].map((width, chip) => (
                <Skeleton
                  key={chip}
                  className="h-5 rounded-full"
                  style={{ width: `${width * 4}px` }}
                />
              ))}
            </div>
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
          </aside>
        </div>
      </div>
    </PageLoading>
  );
}
