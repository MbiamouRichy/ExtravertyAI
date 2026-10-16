import { Skeleton } from "@/components/ui/skeleton";
import {
  AuthDividerSkeleton,
  AuthFieldSkeleton,
  AuthShowcaseSkeleton,
  AuthSocialSkeleton,
  AuthTopBarSkeleton,
} from "@/components/auth/auth-loading";

// Miroir de l’écran d’inscription : panneau produit à gauche, formulaire à droite.
export default function SignUpLoading() {
  return (
    <main
      aria-busy="true"
      className="relative h-full overflow-x-hidden md:min-h-screen lg:grid lg:grid-cols-2 motion-reduce:**:data-[slot=skeleton]:animate-none"
    >
      <p role="status" className="sr-only">
        Chargement de l’inscription…
      </p>
      <AuthShowcaseSkeleton />
      <div aria-hidden="true" className="relative flex min-h-screen flex-col justify-center px-4 pt-8 lg:pt-0">
        <div className="mx-auto mb-8 w-full max-w-sm">
          <AuthTopBarSkeleton />
        </div>

        <div className="mx-auto w-full space-y-4 sm:w-sm">
          <div className="space-y-2">
            <Skeleton className="h-7 w-28" />
            <Skeleton className="h-4 w-60 max-w-full" />
          </div>

          <div className="space-y-4">
            <AuthFieldSkeleton labelWidth="w-32" />
            <AuthFieldSkeleton labelWidth="w-48" />
            <AuthFieldSkeleton labelWidth="w-24" />
            <Skeleton className="h-9 w-full rounded-md" />
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>

          <AuthDividerSkeleton />
          <AuthSocialSkeleton />

          <Skeleton className="mx-auto mt-8 h-4 w-60 max-w-full" />
        </div>
      </div>
    </main>
  );
}
