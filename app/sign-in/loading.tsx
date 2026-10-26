import { Skeleton } from "@/components/ui/skeleton";
import {
  AuthDividerSkeleton,
  AuthFieldSkeleton,
  AuthShowcaseSkeleton,
  AuthSocialSkeleton,
  AuthTopBarSkeleton,
} from "@/components/auth/auth-loading";

// Miroir de l’écran de connexion : formulaire à gauche, panneau produit à droite.
export default function SignInLoading() {
  return (
    <main
      aria-busy="true"
      className="grid min-h-dvh lg:grid-cols-2 motion-reduce:**:data-[slot=skeleton]:animate-none"
    >
      <p role="status" className="sr-only">
        Chargement de la connexion…
      </p>
      <div aria-hidden="true" className="flex flex-col px-4 py-6 sm:px-10">
        <AuthTopBarSkeleton />

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <Skeleton className="h-9 w-44" />
          <Skeleton className="mt-3 h-4 w-72 max-w-full" />

          <div className="mt-8">
            <AuthSocialSkeleton />
          </div>
          <div className="my-6">
            <AuthDividerSkeleton />
          </div>

          <div className="space-y-5">
            <AuthFieldSkeleton labelWidth="w-12" />
            <AuthFieldSkeleton labelWidth="w-24" withAside />
            <div className="flex items-center gap-2">
              <Skeleton className="size-4 rounded-sm" />
              <Skeleton className="h-3.5 w-52" />
            </div>
            <Skeleton className="h-10 w-full rounded-md" />
          </div>

          <Skeleton className="mx-auto mt-8 h-4 w-64 max-w-full" />
        </div>

        <Skeleton className="mx-auto h-3 w-80 max-w-full" />
      </div>
      <AuthShowcaseSkeleton />
    </main>
  );
}
