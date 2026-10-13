import { InviteShell } from "@/components/auth/invite-shell";
import { Skeleton } from "@/components/ui/skeleton";
export default function InviteLoading() {
  return (
    <InviteShell>
      <div role="status" className="space-y-6">
        <span className="sr-only">Chargement de votre invitation…</span>
        <Skeleton className="h-7 w-3/4" />
        <Skeleton className="h-12 w-full" />
        {[0, 1, 2].map((key) => (
          <div key={key} className="space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
        <Skeleton className="h-10 w-full" />
      </div>
    </InviteShell>
  );
}
