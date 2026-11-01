import { Skeleton } from "@/components/ui/skeleton";
import { PageLoading } from "@/components/page-loading";

// Miroir d’Assistant IA tel qu’il s’ouvre : titre, onglets, puis « Consignes ».
const TABS = ["sm:w-20", "sm:w-20", "sm:w-16", "sm:w-20", "sm:w-12", "sm:w-20"];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4 rounded-xl border p-4 sm:p-5">
      <Skeleton className={`h-5 ${title}`} />
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
        <Skeleton className="h-8 w-40 sm:h-9 sm:w-48" />

        {/* Mêmes rangées que les onglets : trois colonnes sur téléphone. */}
        <div className="grid grid-cols-3 gap-y-1 border-b pb-2 sm:flex sm:h-10 sm:items-center sm:gap-5 sm:pb-0">
          {TABS.map((width, tab) => (
            <div key={tab} className="flex h-8 items-center justify-center sm:h-auto">
              <Skeleton className={`h-4 w-14 ${width}`} />
            </div>
          ))}
        </div>

        <Section title="w-20">
          <div className="space-y-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        </Section>

        <Section title="w-16">
          <Skeleton className="h-24 w-full rounded-md" />
        </Section>

        <Section title="w-14">
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <div className="grid gap-2 sm:grid-cols-3">
              {[0, 1, 2].map((tone) => (
                <Skeleton key={tone} className="h-14 rounded-xl sm:h-20" />
              ))}
            </div>
          </div>
        </Section>
      </div>
    </PageLoading>
  );
}
