import { Skeleton } from "@/components/ui/skeleton";
import { PageLoading } from "@/components/page-loading";

// Miroir d’Assistant IA tel qu’il s’ouvre : titre, onglets, puis « Consignes ».
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border p-4 sm:p-5">
      <div className="mb-4 space-y-1.5">
        <Skeleton className={`h-5 ${title}`} />
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>
      {children}
    </div>
  );
}

export default function AssistantLoading() {
  return (
    <PageLoading
      label="Chargement de l’assistant IA…"
      className="mx-auto w-full max-w-4xl p-4 sm:p-6 xl:p-8"
    >
      <div className="space-y-6">
        <Skeleton className="h-9 w-48 max-w-full" />

        <div className="-mx-4 flex h-10 items-center gap-5 overflow-hidden border-b px-4 sm:mx-0 sm:px-0">
          {["w-20", "w-20", "w-16", "w-20", "w-12", "w-20"].map((width, tab) => (
            <Skeleton key={tab} className={`h-4 shrink-0 ${width}`} />
          ))}
        </div>

        <div className="space-y-6">
          <Section title="w-20">
            <div className="space-y-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-11 w-full rounded-md" />
            </div>
          </Section>

          <Section title="w-16">
            <Skeleton className="h-24 w-full rounded-xl" />
          </Section>

          <Section title="w-14">
            <div className="space-y-7">
              <div className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <div className="grid gap-2 sm:grid-cols-3">
                  {[0, 1, 2].map((tone) => (
                    <Skeleton key={tone} className="h-20 rounded-xl" />
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-40" />
                <div className="grid gap-2 sm:grid-cols-3">
                  {[0, 1, 2].map((length) => (
                    <Skeleton key={length} className="h-16 rounded-xl" />
                  ))}
                </div>
              </div>
            </div>
          </Section>
        </div>
      </div>
    </PageLoading>
  );
}
