import { cn } from "@/lib/utils";
import { PageLoading } from "@/components/page-loading";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PhoneChatSkeleton,
  PhoneFrame,
} from "@/components/maquettes/project-new/phone-frame";
import { Eyebrow, Serif } from "@/components/website/vitrine/primitives";

// Miroir de la page Contact : le titre est déjà le vrai, le formulaire,
// l’aperçu WhatsApp et les canaux attendent. Navigation et pied de page
// restent affichés par le layout.

function FieldBone({ label = "w-24", control = "h-11" }: { label?: string; control?: string }) {
  return (
    <div className="space-y-3">
      <Skeleton className={cn("h-4", label)} />
      <Skeleton className={cn("w-full", control)} />
    </div>
  );
}

export default function ContactLoading() {
  return (
    <PageLoading label="Chargement de la page Contact…">
      <section className="grid lg:grid-cols-12">
        <div className="min-w-0 px-4 pt-14 pb-16 sm:px-8 md:pt-20 lg:col-span-7 lg:px-12 lg:pb-24">
          <Eyebrow>
            <span className="text-foreground">Contact</span>
            <span aria-hidden="true"> / </span>
            Réponse humaine sur WhatsApp
          </Eyebrow>
          <p className="mt-5 max-w-2xl font-heading text-5xl leading-[1.06] font-extrabold tracking-[-0.055em] text-balance md:text-6xl lg:text-7xl">
            Parlons de votre <Serif>service client.</Serif>
          </p>
          <p className="mt-6 max-w-lg text-pretty text-muted-foreground md:text-lg">
            Racontez votre quotidien sur WhatsApp. Nous vous montrons ce que
            l’automatisation peut changer, sans engagement.
          </p>

          <div className="mt-12 space-y-7">
            <div className="space-y-3">
              <Skeleton className="h-4 w-24" />
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-9 w-48 rounded-full" />
                <Skeleton className="h-9 w-52 rounded-full" />
                <Skeleton className="h-9 w-40 rounded-full" />
              </div>
            </div>
            <div className="grid gap-7 sm:grid-cols-2 sm:gap-4">
              <FieldBone />
              <FieldBone label="w-28" />
            </div>
            <div className="space-y-3">
              <FieldBone label="w-28" control="h-44" />
              <Skeleton className="h-3 w-44" />
            </div>
            <Skeleton className="h-28 w-full lg:hidden" />
            <div className="space-y-3">
              <Skeleton className="h-12 w-full sm:w-80" />
              <Skeleton className="h-3 w-72 max-w-full" />
            </div>
          </div>
        </div>

        <div className="relative hidden border-l bg-muted/30 lg:col-span-5 lg:block">
          <div className="sticky top-16 flex h-[calc(100dvh-4rem)] flex-col items-center justify-center gap-5 px-6 py-6">
            <div className="flex w-76 items-center justify-between">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-3 w-24" />
            </div>
            <PhoneFrame>
              <PhoneChatSkeleton />
            </PhoneFrame>
            <div className="w-76 space-y-1.5">
              <Skeleton className="mx-auto h-2.5 w-64" />
              <Skeleton className="mx-auto h-2.5 w-48" />
            </div>
          </div>
        </div>
      </section>

      <section className="border-t">
        <div className="grid gap-6 px-4 pt-20 pb-12 sm:px-8 md:pt-28 lg:grid-cols-12 lg:gap-8 lg:px-12">
          <Skeleton className="h-3 w-36 lg:col-span-3 lg:mt-3" />
          <div className="space-y-4 lg:col-span-6">
            <Skeleton className="h-12 w-full max-w-md md:h-14" />
            <Skeleton className="h-4 w-80 max-w-full" />
          </div>
        </div>
        <div className="grid gap-px border-t bg-border lg:grid-cols-12">
          <div className="space-y-6 bg-background px-4 py-10 sm:px-8 lg:col-span-6 lg:row-span-2 lg:px-12">
            <Skeleton className="h-10 w-52" />
            <Skeleton className="h-8 w-64 max-w-full" />
            <Skeleton className="h-4 w-60 max-w-full" />
            <Skeleton className="h-10 w-56" />
          </div>
          {[
            { id: "phone", span: "lg:col-span-6" },
            { id: "email", span: "lg:col-span-3" },
            { id: "clock", span: "lg:col-span-3" },
          ].map(({ id, span }) => (
            <div key={id} className={cn("space-y-6 bg-background px-4 py-8 sm:px-8", span)}>
              <Skeleton className="h-5 w-full max-w-40" />
              <Skeleton className="h-6 w-48 max-w-full" />
              <Skeleton className="h-8 w-40" />
            </div>
          ))}
        </div>
      </section>
    </PageLoading>
  );
}
