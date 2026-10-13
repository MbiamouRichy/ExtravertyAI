import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

function SectionHeading() {
  return (
    <CardHeader className="space-y-2">
      <div className="flex items-center gap-2">
        <Skeleton className="size-5 shrink-0" />
        <Skeleton className="h-5 w-48 max-w-full" />
      </div>
      <Skeleton className="h-4 w-full max-w-sm" />
    </CardHeader>
  );
}

export default function ProfileLoading() {
  return (
    <div
      aria-busy="true"
      className="mx-auto w-full max-w-5xl space-y-8 p-4 md:p-12 motion-reduce:**:data-[slot=skeleton]:animate-none"
    >
      <p role="status" className="sr-only">
        Chargement de votre profil et de vos paramètres…
      </p>
      <div aria-hidden="true" className="space-y-8">
        <div className="space-y-3">
          <Skeleton className="h-9 w-64 max-w-full" />
          <Skeleton className="h-5 w-full max-w-2xl" />
        </div>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          <div className="min-w-0 md:sticky md:top-20 md:self-start lg:col-span-1">
            <Card className="border-border shadow-sm">
              <CardContent className="flex flex-col items-center pt-6">
                <Skeleton className="mb-4 size-24 rounded-full" />
                <Skeleton className="h-6 w-40 max-w-full" />
                <Skeleton className="mb-4 mt-2 h-4 w-52 max-w-full" />
                <div className="w-full space-y-2">
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="min-w-0 space-y-6 lg:col-span-2">
            <Card className="border-border shadow-sm">
              <SectionHeading />
              <CardContent className="space-y-6">
                {[0, 1].map((index) => (
                  <div key={index} className="space-y-6">
                    {index > 0 && <Separator />}
                    <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
                      <div className="min-w-0 flex-1 space-y-3">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-4 w-48 max-w-full" />
                      </div>
                      <Skeleton className="h-8 w-full shrink-0 lg:w-40" />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card className="border-border shadow-sm">
              <SectionHeading />
              <CardContent className="space-y-4">
                <Skeleton className="h-8 w-64 max-w-full" />
                {[0, 1].map((index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 rounded-xl border p-4"
                  >
                    <Skeleton className="size-9 shrink-0 rounded-lg" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <Skeleton className="h-4 w-40 max-w-full" />
                      <Skeleton className="h-3 w-full max-w-56" />
                      <Skeleton className="h-3 w-28" />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <SectionHeading />
              <CardContent>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {[0, 1, 2].map((index) => (
                    <div
                      key={index}
                      className="space-y-3 rounded-lg border p-3"
                    >
                      <Skeleton className="h-24 w-full" />
                      <Skeleton className="mx-auto h-4 w-14" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card className="border-destructive/20 bg-destructive/5">
              <SectionHeading />
              <CardContent>
                <div className="flex flex-col gap-4 rounded-lg border border-destructive/20 bg-background p-4 lg:flex-row lg:items-center">
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-4 w-36 max-w-full" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                  <Skeleton className="h-9 w-full shrink-0 lg:w-44" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
