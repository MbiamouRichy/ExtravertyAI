import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { DecorIcon } from "@/components/decor-icon";
// Assurez-vous d'adapter le chemin de votre DecorIcon selon votre architecture

export default function Loading() {
    return (
        <div className="relative flex h-screen w-full items-center justify-center overflow-hidden px-6 md:px-8">
            <div
                className={cn(
                    "relative flex w-full max-w-sm flex-col justify-between p-6 md:p-8",
                    "dark:bg-[radial-gradient(50%_80%_at_20%_0%,--theme(--color-foreground/.1),transparent)]"
                )}
            >
                {/* Éléments décoratifs et bordures conservés à l'identique pour éviter un saut visuel */}
                <div className="absolute -inset-y-6 -left-px w-px bg-border" />
                <div className="absolute -inset-y-6 -right-px w-px bg-border" />
                <div className="absolute -inset-x-6 -top-px h-px bg-border" />
                <div className="absolute -inset-x-6 -bottom-px h-px bg-border" />
                <DecorIcon position="top-left" />
                <DecorIcon position="bottom-right" />

                <div className="w-full max-w-sm animate-in fade-in zoom-in-95 duration-500 space-y-8">
                    {/* Header Skeleton */}
                    <div className="flex flex-col space-y-2">
                        <Skeleton className="h-8 w-3/4 rounded-md" /> {/* H1 */}
                        <Skeleton className="h-4 w-full rounded-md" /> {/* P line 1 */}
                        <Skeleton className="h-4 w-5/6 rounded-md" /> {/* P line 2 */}
                    </div>

                    {/* Form Skeleton */}
                    <div className="space-y-4">
                        <div className="flex flex-col gap-4">
                            {/* Skeleton Champ Email */}
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-12 rounded-md" /> {/* Label */}
                                <Skeleton className="h-10 w-full rounded-md" /> {/* Input */}
                            </div>

                            {/* Skeleton Champ Mot de passe */}
                            <div className="space-y-2">
                                <div className="flex w-full items-center justify-between">
                                    <Skeleton className="h-4 w-24 rounded-md" /> {/* Label */}
                                    <Skeleton className="h-4 w-32 rounded-md" /> {/* Lien mot de passe oublié */}
                                </div>
                                <Skeleton className="h-10 w-full rounded-md" /> {/* Input */}
                            </div>

                            {/* Skeleton Checkbox "Se souvenir de moi" */}
                            <div className="flex items-center space-x-2 pt-2">
                                <Skeleton className="h-4 w-4 rounded-sm" />
                                <Skeleton className="h-4 w-32 rounded-md" />
                            </div>

                            {/* Skeleton Bouton Submit */}
                            <Skeleton className="mt-2 h-10 w-full rounded-md" />

                            {/* Skeleton Lien "Pas de compte ?" */}
                            <div className="flex justify-center pt-2">
                                <Skeleton className="h-4 w-48 rounded-md" />
                            </div>
                        </div>

                        {/* Skeleton Séparateur "Ou" */}
                        <div className="flex items-center gap-4 py-2">
                            <Skeleton className="h-px w-full" />
                            <Skeleton className="h-4 w-8 rounded-md" />
                            <Skeleton className="h-px w-full" />
                        </div>

                        {/* Skeleton Bouton Social (Google) */}
                        <Skeleton className="h-10 w-full rounded-md" />
                    </div>

                    {/* Skeleton Footer (Politique de confidentialité) */}
                    <div className="flex flex-col space-y-2 pt-2">
                        <Skeleton className="h-3 w-full rounded-md" />
                        <Skeleton className="h-3 w-4/5 rounded-md" />
                    </div>
                </div>
            </div>
        </div>
    );
}