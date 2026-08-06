import { Skeleton } from "@/components/ui/skeleton"

export default function ProjectsLoading() {
    return (
        <div className="flex w-full flex-col mx-auto max-w-7xl space-y-6 md:space-y-8 p-4 sm:p-6 md:p-8">

            {/* En-tête de page (Reprend exactement le layout flex/col->row) */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-2.5">
                    {/* Skeleton du Titre */}
                    <Skeleton className="h-8 w-32 md:h-9" />
                    {/* Skeleton du Sous-titre */}
                    <Skeleton className="h-4 w-[280px] sm:w-[350px] md:w-[450px]" />
                </div>
                {/* Skeleton du Bouton "Nouveau projet" */}
                <Skeleton className="h-10 w-full md:w-[160px] shrink-0 rounded-md" />
            </div>

            <div className="animate-in fade-in duration-500">

                {/* VUE MOBILE : Skeleton des Cartes (Visible uniquement sur mobile) */}
                <div className="grid grid-cols-1 gap-4 md:hidden">
                    {[1, 2, 3].map((i) => (
                        <div
                            key={`mobile-skeleton-${i}`}
                            className="flex flex-col p-5 rounded-xl border border-border bg-card shadow-sm space-y-4"
                        >
                            {/* Titre + Badge */}
                            <div className="flex items-start justify-between gap-2">
                                <Skeleton className="h-6 w-1/2" />
                                <Skeleton className="h-5 w-16 rounded-full" />
                            </div>

                            <div className="grid grid-cols-1 gap-3">
                                {/* Numéro de téléphone */}
                                <div className="flex items-center gap-3">
                                    <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                                    <Skeleton className="h-5 w-32" />
                                </div>

                                {/* Bloc Instance */}
                                <Skeleton className="h-10 w-full rounded-lg" />

                                {/* Date d'expiration */}
                                <Skeleton className="h-4 w-40 mt-1" />

                                {/* Boutons d'action */}
                                <div className="grid grid-cols-2 gap-2 mt-2 pt-3 border-t border-border/50">
                                    <Skeleton className="h-9 w-full rounded-md" />
                                    <Skeleton className="h-9 w-full rounded-md" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* VUE DESKTOP : Skeleton du DataTable (Visible uniquement sur desktop) */}
                <div className="hidden md:flex md:flex-col space-y-4">

                    {/* Toolbar du tableau (Recherche + Bouton d'affichage) */}
                    <div className="flex items-center justify-between gap-4">
                        <Skeleton className="h-10 w-full max-w-sm rounded-md" />
                        <Skeleton className="h-10 w-[110px] rounded-md ml-auto" />
                    </div>

                    {/* Conteneur du tableau */}
                    <div className="rounded-md border bg-card overflow-hidden">

                        {/* Header du tableau */}
                        <div className="flex items-center bg-muted/50 border-b px-4 py-3 gap-4">
                            <Skeleton className="h-4 w-[15%] shrink-0" /> {/* Projet */}
                            <Skeleton className="h-4 w-[15%] shrink-0" /> {/* Numéro */}
                            <Skeleton className="h-4 w-[10%] shrink-0" /> {/* Plan */}
                            <Skeleton className="h-4 w-[10%] shrink-0" /> {/* Etat numero */}
                            <Skeleton className="h-4 w-[15%] shrink-0" /> {/* Statut projet */}
                            <Skeleton className="h-4 w-[20%] shrink-0" /> {/* utilisation */}
                            <Skeleton className="h-4 w-[15%] shrink-0" /> {/* Date */}
                            <Skeleton className="h-4 w-8 shrink-0 ml-auto" /> {/* Actions */}
                        </div>

                        {/* Lignes du tableau */}
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div
                                key={`desktop-skeleton-${i}`}
                                className="flex items-center px-4 py-4 gap-4 border-b border-border/50 last:border-0"
                            >
                                <Skeleton className="h-4 w-4 rounded-sm shrink-0" />
                                <Skeleton className="h-5 w-[15%] shrink-0" />
                                <Skeleton className="h-5 w-[15%] shrink-0" />
                                <Skeleton className="h-6 w-[10%] rounded-md shrink-0" /> {/* Badge instance */}
                                <Skeleton className="h-5 w-[15%] shrink-0" />
                                <Skeleton className="h-5 w-[10%] rounded-full shrink-0" /> {/* Badge statut */}
                                <Skeleton className="h-5 w-[15%] shrink-0" />
                                <Skeleton className="h-8 w-8 rounded-md shrink-0 ml-auto" />
                            </div>
                        ))}
                    </div>

                    {/* Pagination / Compteur */}
                    <div className="flex items-center justify-end pt-2">
                        <Skeleton className="h-4 w-48" />
                    </div>
                </div>

            </div>
        </div>
    )
}