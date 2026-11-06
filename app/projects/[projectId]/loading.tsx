import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { PageLoading } from "@/components/page-loading";

// Miroir du tableau de bord : en-tête, indicateurs, activité, contacts et équipe, raccourcis.

function SectionTitle() {
  return <Skeleton className="mb-3 h-4 w-32" />;
}

function Panel({ children }: { children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl border bg-card p-4 sm:px-5">
      <div className="mb-4 space-y-2">
        <Skeleton className="h-3.5 w-36 max-w-full" />
        <Skeleton className="h-3 w-48 max-w-full" />
      </div>
      {children}
    </div>
  );
}

function Rows({ count }: { count: number }) {
  return (
    <div className="divide-y">
      {Array.from({ length: count }, (_, row) => (
        <div key={row} className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-32 max-w-full" />
            <Skeleton className="h-3 w-24 max-w-full" />
          </div>
          <Skeleton className="h-3 w-10 shrink-0" />
        </div>
      ))}
    </div>
  );
}

const chart = <Skeleton className="h-56 rounded-lg sm:h-64" />;

export default function DashboardLoading() {
  return (
    <PageLoading
      label="Chargement du tableau de bord…"
      className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8"
    >
      <div className="@container space-y-8">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="min-w-0 space-y-2">
            <Skeleton className="h-8 w-48 max-w-full" />
            <Skeleton className="h-4 w-64 max-w-full" />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Skeleton className="h-9 rounded-md sm:w-32" />
            <Skeleton className="h-9 rounded-md sm:w-32" />
          </div>
        </header>

        <section>
          <SectionTitle />
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border @3xl:grid-cols-4">
            {[0, 1, 2, 3].map((card) => (
              <div key={card} className="space-y-2 bg-card p-3 sm:p-4">
                <Skeleton className="h-3 w-24 max-w-full" />
                <Skeleton className="h-7 w-14" />
                <Skeleton className="h-3 w-28 max-w-full" />
              </div>
            ))}
          </div>
        </section>

        <section>
          <SectionTitle />
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 @4xl:grid-cols-2">
              <Panel>{chart}</Panel>
              <Panel>{chart}</Panel>
            </div>
            <div className="grid grid-cols-1 gap-4 @4xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <Panel>{chart}</Panel>
              <Panel>
                <div className="flex flex-col items-center gap-4">
                  <Skeleton className="relative size-40 rounded-full">
                    <span className="absolute inset-[17%] rounded-full bg-card" />
                  </Skeleton>
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-4/5" />
                </div>
              </Panel>
            </div>
          </div>
        </section>

        {/* Contacts récents et équipe */}
        <section>
          <SectionTitle />
          <div className="grid grid-cols-1 gap-4 @4xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Panel>
              <Rows count={5} />
            </Panel>
            <Panel>
              <Rows count={2} />
            </Panel>
          </div>
        </section>

        <section>
          <SectionTitle />
          <div className="grid grid-cols-1 gap-0.5 rounded-xl border bg-card p-1.5 @xl:grid-cols-2 @4xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, action) => (
              <div key={action} className="flex items-center gap-3 p-2.5">
                <Skeleton className="size-4 shrink-0 rounded-sm" />
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
