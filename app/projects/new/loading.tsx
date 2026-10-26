import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Mirrors CreateProjectForm's layout so nothing shifts when the form appears.
function Bone({ className }: { className?: string }) {
  return <Skeleton className={cn("motion-reduce:animate-none", className)} />;
}

export default function LoadingNewProject() {
  return (
    <div
      role="status"
      aria-busy="true"
      className="mx-auto w-full max-w-5xl px-4 pb-36 pt-6 sm:px-6 sm:pt-8 lg:px-8 lg:pb-16 lg:pt-10"
    >
      <span className="sr-only">
        Chargement du formulaire de création de projet…
      </span>

      <div aria-hidden>
        <div className="flex h-11 items-center">
          <Bone className="h-4 w-24" />
        </div>
        <div className="mt-4 mb-8 space-y-3 sm:mb-10">
          <Bone className="h-8 w-52" />
          <Bone className="h-4 w-full max-w-md" />
          <div className="flex gap-3 pt-3">
            {[0, 1, 2].map((step) => (
              <Bone key={step} className="h-5 w-20 rounded-full" />
            ))}
          </div>
        </div>

        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-12">
          <div className="min-w-0 space-y-10">
            <div>
              <StepHeadingBone />
              <div className="space-y-6">
                <FieldBone />
                <div className="grid gap-6 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-4">
                  <FieldBone />
                  <FieldBone />
                </div>
              </div>
            </div>
            <div>
              <StepHeadingBone />
              <div className="grid gap-3 md:grid-cols-3">
                {[0, 1, 2].map((plan) => (
                  <div key={plan} className="space-y-3 rounded-xl border p-4">
                    <Bone className="h-4 w-20" />
                    <Bone className="h-7 w-24" />
                    <Bone className="h-3 w-32" />
                    <Bone className="h-3 w-full" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-xl border">
            <div className="space-y-2 p-5">
              <Bone className="h-3 w-24" />
              <Bone className="h-5 w-40" />
            </div>
            <div className="space-y-3 border-t p-5">
              {[0, 1, 2].map((row) => (
                <div key={row} className="flex justify-between gap-4">
                  <Bone className="h-4 w-24" />
                  <Bone className="h-4 w-20" />
                </div>
              ))}
            </div>
            <div className="space-y-2 border-t p-5">
              <Bone className="h-7 w-full" />
              <Bone className="h-3 w-4/5" />
            </div>
            <div className="hidden space-y-3 border-t p-5 lg:block">
              <Bone className="h-10 w-full" />
              <Bone className="mx-auto h-3 w-48" />
            </div>
          </div>
        </div>
      </div>

      <div
        aria-hidden
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-background px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden"
      >
        <div className="mx-auto flex max-w-5xl items-center gap-4">
          <div className="flex-1 space-y-2">
            <Bone className="h-4 w-36" />
            <Bone className="h-3 w-24" />
          </div>
          <Bone className="h-10 w-32" />
        </div>
      </div>
    </div>
  );
}

function StepHeadingBone() {
  return (
    <div className="mb-5 space-y-2">
      <Bone className="h-3 w-20" />
      <Bone className="h-5 w-36" />
      <Bone className="h-4 w-full max-w-sm" />
    </div>
  );
}

function FieldBone() {
  return (
    <div className="space-y-3">
      <Bone className="h-4 w-28" />
      <Bone className="h-11 w-full" />
    </div>
  );
}
