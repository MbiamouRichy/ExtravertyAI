import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectLoadingShell } from "@/components/dashboard/project/project-loading-shell";

export default function SettingsLoading() {
  return (
    <ProjectLoadingShell label="Chargement des paramètres du projet…">
      <div className="grid gap-7 lg:grid-cols-[210px_minmax(0,1fr)]">
        <div className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton
              key={index}
              className="h-11 w-48 shrink-0 rounded-xl lg:w-full"
            />
          ))}
        </div>
        <div className="grid min-w-0 gap-7 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-6">
            <Card className="gap-6 p-5 sm:p-7">
              <CardHeader className="flex flex-row items-center gap-3 p-0">
                <Skeleton className="size-10 shrink-0 rounded-xl" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-6 w-48 max-w-full" />
                  <Skeleton className="h-4 w-full" />
                </div>
              </CardHeader>
              <CardContent className="space-y-3 p-0">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </CardContent>
            </Card>
            <Card className="gap-5 p-5 sm:p-7">
              <CardHeader className="space-y-2 p-0">
                <Skeleton className="h-6 w-56 max-w-full" />
                <Skeleton className="h-4 w-full" />
              </CardHeader>
              <CardContent className="space-y-4 p-0">
                <Skeleton className="h-28 w-full rounded-xl" />
                <Skeleton className="h-4 w-40 max-w-full" />
                <Skeleton className="h-64 w-full rounded-xl" />
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-10 w-48 max-w-full" />
              </CardContent>
            </Card>
            <Card className="gap-5 p-5 sm:p-7">
              <CardHeader className="space-y-2 p-0">
                <Skeleton className="h-6 w-48 max-w-full" />
                <Skeleton className="h-4 w-full" />
              </CardHeader>
              <CardContent className="space-y-5 p-0">
                <div className="grid gap-3 sm:grid-cols-3">
                  {Array.from({ length: 3 }, (_, index) => (
                    <Skeleton key={index} className="h-28 w-full rounded-xl" />
                  ))}
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              </CardContent>
            </Card>
            <div className="flex justify-end border-t pt-5">
              <Skeleton className="h-12 w-48 max-w-full" />
            </div>
          </div>
          <Card className="self-start bg-muted/50 p-5">
            <CardHeader className="p-0">
              <Skeleton className="h-4 w-40" />
            </CardHeader>
            <CardContent className="space-y-5 p-0">
              <Card className="p-4">
                <div className="flex items-center gap-3 border-b pb-4">
                  <Skeleton className="size-10 shrink-0 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                </div>
                <Skeleton className="h-16 w-5/6 rounded-xl" />
                <Skeleton className="ml-auto h-32 w-5/6 rounded-xl" />
              </Card>
              <Skeleton className="h-4 w-full" />
              <div className="space-y-4 border-t pt-5">
                <Skeleton className="h-4 w-40" />
                {Array.from({ length: 3 }, (_, index) => (
                  <Skeleton key={index} className="h-8 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </ProjectLoadingShell>
  );
}
