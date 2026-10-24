import { cn } from "@/lib/utils";
import { PageLoading } from "@/components/page-loading";
import { Skeleton } from "@/components/ui/skeleton";
import { AboutHeroCopy } from "@/components/maquettes/apropos/about-hero";

// Miroir de la page À propos : le titre et le manifeste sont déjà les vrais ;
// le comparatif de conversations, les chiffres et les principes attendent.

const BUBBLES = [
  { id: "q", className: "h-12 w-3/5 self-start rounded-bl-sm" },
  { id: "a", className: "h-20 w-3/4 self-end rounded-br-sm" },
  { id: "c", className: "h-12 w-2/5 self-start rounded-bl-sm" },
  { id: "s", className: "h-7 w-48 self-center rounded-full" },
  { id: "h", className: "h-16 w-3/5 self-end rounded-br-sm" },
];

export default function AproposLoading() {
  return (
    <PageLoading label="Chargement de la page À propos…">
      <AboutHeroCopy titleAs="p" />

      <section className="border-t">
        <div className="grid lg:grid-cols-12">
          <div className="space-y-6 px-4 py-14 sm:px-8 lg:col-span-5 lg:px-12 lg:py-20">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-11 w-full max-w-sm md:h-13" />
            <Skeleton className="h-11 w-3/4 md:h-13" />
            <div className="space-y-2 pt-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-11/12" />
              <Skeleton className="h-4 w-2/3" />
            </div>
            <Skeleton className="h-10 w-52" />
          </div>
          <div className="border-t lg:col-span-7 lg:border-t-0 lg:border-l">
            <div className="flex items-center justify-between border-b px-4 py-3 sm:px-6">
              <Skeleton className="h-9 w-72 max-w-full" />
              <Skeleton className="hidden h-3 w-20 sm:block" />
            </div>
            <div className="flex min-h-112 flex-col gap-2.5 bg-muted/40 p-4 sm:p-6">
              {BUBBLES.map((bubble) => (
                <Skeleton key={bubble.id} className={cn("rounded-2xl", bubble.className)} />
              ))}
            </div>
            <div className="flex items-start gap-3 border-t px-4 py-4 sm:px-6">
              <Skeleton className="size-7 rounded-md" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-72 max-w-full" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-px border-t bg-border lg:grid-cols-4">
        {["day", "connect", "formats", "takeover"].map((fact) => (
          <div key={fact} className="space-y-3 bg-background px-4 py-8 sm:px-8 md:py-10 lg:px-12">
            <Skeleton className="h-10 w-24 md:h-12" />
            <Skeleton className="h-3 w-36 max-w-full" />
          </div>
        ))}
      </div>

      <section className="border-t">
        <div className="grid gap-6 px-4 pt-20 pb-12 sm:px-8 md:pt-28 lg:grid-cols-12 lg:gap-8 lg:px-12">
          <Skeleton className="h-3 w-36 lg:col-span-3 lg:mt-3" />
          <div className="space-y-4 lg:col-span-6">
            <Skeleton className="h-12 w-full max-w-md md:h-14" />
            <Skeleton className="h-4 w-80 max-w-full" />
          </div>
        </div>
        <div className="grid gap-px border-t bg-border lg:grid-cols-3">
          {["reality", "useful", "control"].map((principle) => (
            <div key={principle} className="space-y-8 bg-background px-4 py-10 sm:px-8 lg:px-10">
              <Skeleton className="size-5" />
              <div className="space-y-2">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
              </div>
              <Skeleton className="h-16 w-full" />
            </div>
          ))}
        </div>
      </section>
    </PageLoading>
  );
}
