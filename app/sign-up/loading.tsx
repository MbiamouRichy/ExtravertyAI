import { Skeleton } from "@/components/ui/skeleton";
import {
  AuthDividerSkeleton,
  AuthFieldSkeleton,
  AuthShowcaseSkeleton,
  AuthSocialSkeleton,
  AuthTopBarSkeleton,
} from "@/components/auth/auth-loading";

// Miroir de l’inscription en une étape : nom, e-mail, « Continuer », puis
// Google et TikTok. Mêmes boîtes de ligne que la page, panneau produit à
// gauche sur grand écran.
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

        <div className="mx-auto w-full max-w-sm space-y-6">
          <div className="space-y-2">
            <div className="flex h-8 items-center md:h-9.5">
              <Skeleton className="h-7 w-64 max-w-full md:h-8" />
            </div>
            <div>
              <div className="flex h-5.5 items-center">
                <Skeleton className="h-3.5 w-full" />
              </div>
              <div className="flex h-5.5 items-center">
                <Skeleton className="h-3.5 w-2/3" />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-5">
            <AuthFieldSkeleton labelWidth="w-10" />
            <AuthFieldSkeleton labelWidth="w-14" />
            <div className="flex flex-col gap-3">
              <Skeleton className="h-10 w-full rounded-md" />
              <div>
                <div className="flex h-4.5 items-center">
                  <Skeleton className="h-3 w-full" />
                </div>
                <div className="flex h-4.5 items-center">
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            </div>
          </div>

          <AuthDividerSkeleton labelWidth="w-6" />
          <AuthSocialSkeleton />

          <div className="flex h-5.5 items-center justify-center">
            <Skeleton className="h-3.5 w-56 max-w-full" />
          </div>
        </div>
      </div>
    </main>
  );
}
