import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { PageLoading } from "@/components/page-loading";

// Miroir du tableau de bord : en-tête, indicateurs, activité, contacts et équipe, raccourcis.

function SectionTitle() {
  return (
    <div className="mb-4 space-y-1.5">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-3.5 w-72 max-w-full" />
    </div>
  );
}

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`min-w-0 rounded-2xl border bg-card ${className}`}>
      <div className="space-y-2 p-4 sm:p-6">
        <Skeleton className="h-4 w-44 max-w-full" />
        <Skeleton className="h-3 w-64 max-w-full" />
      </div>
      {children}
    </div>
  );
}

function Bars() {
  const bars = [18, 34, 22, 48, 30, 62, 40];
  return (
    <div className="flex h-48 items-end gap-2 px-4 pb-5 sm:px-6">
      {bars.map((value, index) => (
        <Skeleton
          key={index}
          className="flex-1 rounded-b-none rounded-t-sm"
          style={{ height: `${value}%` }}
        />
      ))}
    </div>
  );
}

export default function DashboardLoading() {
  return (
    <PageLoading
      label="Chargement du tableau de bord…"
      className="mx-auto w-full max-w-(--breakpoint-2xl) p-4 md:p-6 xl:p-8"
    >
      <div className="space-y-8">
        <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div className="min-w-0 space-y-3">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-9 w-64 max-w-full" />
            <div className="flex items-center gap-2">
              <Skeleton className="size-4 rounded-full" />
              <div className="space-y-1.5">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3 w-28" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Skeleton className="h-9 rounded-md sm:w-48" />
            <Skeleton className="h-9 rounded-md sm:w-44" />
          </div>
        </header>

        <section>
          <SectionTitle />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((card) => (
              <div key={card} className="space-y-4 rounded-2xl border bg-card p-4">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-3 w-40 max-w-full" />
              </div>
            ))}
          </div>
        </section>

        <section>
          <SectionTitle />
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              <Panel>
                <Bars />
              </Panel>
              <Panel>
                <Bars />
              </Panel>
            </div>
            <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <Panel>
                <Skeleton className="mx-4 mb-5 h-56 rounded-lg sm:mx-6" />
              </Panel>
              <Panel>
                <div className="flex flex-col items-center gap-4 px-4 pb-5 sm:px-6">
                  <Skeleton className="relative size-40 rounded-full">
                    <span className="absolute inset-[18%] rounded-full bg-card" />
                  </Skeleton>
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-4/5" />
                </div>
              </Panel>
            </div>
          </div>
        </section>

        {/* Contacts récents et équipe (avec action « Assigner ») */}
        <section>
          <SectionTitle />
          <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Panel>
              <div className="divide-y border-t">
                {[0, 1, 2, 3, 4].map((row) => (
                  <div key={row} className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
                    <Skeleton className="h-4 w-36 max-w-[40%]" />
                    <Skeleton className="hidden h-3.5 w-28 sm:block" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                ))}
              </div>
            </Panel>
            <Panel>
              <div className="divide-y border-t">
                {[0, 1].map((row) => (
                  <div key={row} className="flex items-center gap-3 px-4 py-3">
                    <Skeleton className="size-9 shrink-0 rounded-full" />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-28 max-w-full" />
                      <Skeleton className="h-3 w-36 max-w-full" />
                    </div>
                    <Skeleton className="h-8 w-24 shrink-0 rounded-md" />
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </section>

        <section>
          <SectionTitle />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, action) => (
              <div key={action} className="flex items-center gap-3 rounded-2xl border bg-card p-4">
                <Skeleton className="size-9 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-3 w-32 max-w-full" />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </PageLoading>
  );
}
