import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
    return (
        <main className="relative md:min-h-screen h-full overflow-x-hidden lg:grid lg:grid-cols-2">

            {/* Colonne de gauche (Visible uniquement sur Desktop) */}
            <div className="relative hidden h-full flex-col border-r bg-secondary p-10 lg:flex dark:bg-secondary/20">
                <div className="absolute inset-0 bg-linear-to-b from-transparent via-transparent to-background" />

                {/* Skeleton du Logo */}
                <Skeleton className="mr-auto h-10 w-10 rounded-md" />

                {/* Skeleton de la Citation (Témoignage) */}
                <div className="z-10 mt-auto space-y-4">
                    <div className="space-y-2">
                        <Skeleton className="h-6 w-full rounded-md" />
                        <Skeleton className="h-6 w-5/6 rounded-md" />
                        <Skeleton className="h-6 w-4/6 rounded-md" />
                    </div>
                    <Skeleton className="h-4 w-32 rounded-md mt-4" /> {/* Auteur */}
                </div>

                {/* Si vous préférez, vous pouvez rendre directement <FloatingPaths /> ici pour ne pas avoir de "saut" de l'animation au chargement de la vraie page */}
                <div className="absolute inset-0 -z-10 opacity-50">
                    {/* Emplacement pour <FloatingPaths /> */}
                </div>
            </div>

            {/* Colonne de droite (Formulaire) */}
            <div className="relative flex min-h-screen flex-col justify-center pt-8 lg:pt-0 px-4">

                {/* Top Shades (Gradients conservés à l'identique pour éviter le CLS) */}
                <div aria-hidden className="absolute inset-0 isolate -z-10 opacity-60 contain-strict">
                    <div className="absolute top-0 right-0 h-320 w-140 -translate-y-87.5 rounded-full bg-[radial-gradient(68.54%_68.72%_at_55.02%_31.46%,--theme(--color-foreground/.06)_0,hsla(0,0%,55%,.02)_50%,--theme(--color-foreground/.01)_80%)]" />
                    <div className="absolute top-0 right-0 h-320 w-60 rounded-full bg-[radial-gradient(50%_50%_at_50%_50%,--theme(--color-foreground/.04)_0,--theme(--color-foreground/.01)_80%,transparent_100%)] [translate:5%_-50%]" />
                    <div className="absolute top-0 right-0 h-320 w-60 -translate-y-87.5 rounded-full bg-[radial-gradient(50%_50%_at_50%_50%,--theme(--color-foreground/.04)_0,--theme(--color-foreground/.01)_80%,transparent_100%)]" />
                </div>

                {/* Skeleton Bouton Retour Mobile */}
                <div className="md:hidden flex self-start mb-5 lg:mb-0">
                    <Skeleton className="h-9 w-24 rounded-md" />
                </div>

                {/* Container Principal du Formulaire */}
                <div className="mx-auto w-full space-y-4 sm:w-sm animate-in fade-in zoom-in-95 duration-500">

                    {/* Header Skeleton */}
                    <div className="flex flex-col space-y-2">
                        <Skeleton className="h-8 w-32 rounded-md" /> {/* H1 S'inscrire */}
                        <Skeleton className="h-4 w-64 rounded-md" /> {/* Description */}
                    </div>

                    {/* Skeletons des champs du formulaire */}
                    <div className="flex flex-col gap-4 mt-2">
                        {/* Champ Nom */}
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-32 rounded-md" /> {/* Label */}
                            <Skeleton className="h-10 w-full rounded-md" /> {/* Input */}
                        </div>

                        {/* Champ Email */}
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-48 rounded-md" /> {/* Label */}
                            <Skeleton className="h-10 w-full rounded-md" /> {/* Input */}
                        </div>

                        {/* Champ Mot de passe */}
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-28 rounded-md" /> {/* Label */}
                            <Skeleton className="h-10 w-full rounded-md" /> {/* Input */}
                        </div>

                        {/* Bouton Submit & Texte Confidentialité */}
                        <div className="space-y-3 pt-2">
                            <Skeleton className="h-10 w-full rounded-md" />
                            <div className="flex justify-center">
                                <Skeleton className="h-3 w-5/6 rounded-md" />
                            </div>
                        </div>
                    </div>

                    {/* Séparateur "Ou" */}
                    <div className="flex items-center gap-4 py-4">
                        <Skeleton className="h-px w-full" />
                        <Skeleton className="h-4 w-8 rounded-md" />
                        <Skeleton className="h-px w-full" />
                    </div>

                    {/* Bouton Social */}
                    <div className="space-y-2">
                        <Skeleton className="h-10 w-full rounded-md" />
                    </div>

                    {/* Lien "Déjà un compte ?" */}
                    <div className="flex justify-center pt-6">
                        <Skeleton className="h-4 w-56 rounded-md" />
                    </div>
                </div>
            </div>
        </main>
    );
}