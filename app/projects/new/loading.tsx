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
      className="mx-auto w-full max-w-xl px-4 pt-6 pb-16 sm:px-6 sm:pt-10"
    >
      <span className="sr-only">
        Chargement du formulaire de création de projet…
      </span>

      <div aria-hidden>
        <div className="flex h-11 items-center">
          <Bone className="h-4 w-24" />
        </div>
        <div className="mt-4 mb-8 space-y-2">
          <Bone className="h-8 w-52" />
          <Bone className="h-5 w-64 max-w-full" />
        </div>

        <div className="space-y-8">
          <div className="space-y-6">
            <FieldBone />
            <div className="grid gap-6 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-4">
              <FieldBone />
              <FieldBone />
            </div>
          </div>

          <div>
            <Bone className="mb-3 h-4 w-16" />
            <div className="divide-y rounded-xl border">
              {[0, 1, 2].map((plan) => (
                <div
                  key={plan}
                  className="flex items-center justify-between gap-4 p-4"
                >
                  <div className="space-y-2">
                    <Bone className="h-4 w-24" />
                    <Bone className="h-3 w-40" />
                  </div>
                  <Bone className="h-5 w-20" />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4 border-t pt-6">
            <div className="flex items-baseline justify-between gap-4">
              <Bone className="h-4 w-32" />
              <Bone className="h-7 w-16" />
            </div>
            <Bone className="h-3 w-4/5" />
            <Bone className="h-10 w-full" />
          </div>
        </div>
      </div>
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
