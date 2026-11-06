import { Skeleton } from "@/components/ui/skeleton";
import {
  AuthDividerSkeleton,
  AuthFieldSkeleton,
  AuthShowcaseSkeleton,
  AuthSocialSkeleton,
  AuthTopBarSkeleton,
} from "@/components/auth/auth-loading";

// Miroir de l’écran de connexion par code : titre, Google et TikTok, e-mail,
// « Recevoir un code » puis le lien vers le mot de passe. Mêmes boîtes de
// ligne que la page pour qu’elle remplace le squelette sans décalage.
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

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-8 sm:py-12">
          <div className="flex h-8 items-center md:h-9.5">
            <Skeleton className="h-7 w-44 md:h-8" />
          </div>
          <div className="mt-2">
            <div className="flex h-5.5 items-center">
              <Skeleton className="h-3.5 w-full" />
            </div>
            <div className="flex h-5.5 items-center">
              <Skeleton className="h-3.5 w-1/3" />
            </div>
          </div>

          <div className="mt-6 sm:mt-8">
            <AuthSocialSkeleton />
          </div>
          <div className="my-5 sm:my-6">
            <AuthDividerSkeleton labelWidth="w-32" />
          </div>

          <div className="flex flex-col gap-5">
            <AuthFieldSkeleton labelWidth="w-10" />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-10 w-full rounded-md" />
              <div className="flex h-9 items-center justify-center gap-2">
                <Skeleton className="size-4 rounded-sm" />
                <Skeleton className="h-3.5 w-48" />
              </div>
            </div>
          </div>

          <div className="mt-6 flex h-5.5 items-center justify-center sm:mt-8">
            <Skeleton className="h-3.5 w-72 max-w-full" />
          </div>
        </div>

        <div className="flex h-5 items-center justify-center">
          <Skeleton className="h-3 w-80 max-w-full" />
        </div>
      </div>
      <AuthShowcaseSkeleton />
    </main>
  );
}
