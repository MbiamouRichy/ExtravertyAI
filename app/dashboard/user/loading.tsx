import { Skeleton } from "@/components/ui/skeleton";

export default function UserProfileLoading() {
    return (
        <div className="mx-auto max-w-4xl space-y-8 p-6 md:p-8">
            {/* En-tête de la page */}
            <div className="space-y-2">
                <Skeleton className="h-8 w-[250px]" />
                <Skeleton className="h-4 w-[400px] text-muted-foreground" />
            </div>

            <div className="space-y-6">
                {/* Bloc 1 : Informations du profil (Avatar & Champs) */}
                <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
                    <div className="flex flex-col space-y-1.5 p-6 border-b border-border/50">
                        <Skeleton className="h-6 w-[180px]" />
                        <Skeleton className="h-4 w-[300px]" />
                    </div>

                    <div className="p-6 space-y-8">
                        {/* Avatar Skeleton */}
                        <div className="flex items-center gap-6">
                            <Skeleton className="h-20 w-20 rounded-full" />
                            <div className="space-y-2">
                                <Skeleton className="h-5 w-[150px]" />
                                <Skeleton className="h-4 w-[250px]" />
                            </div>
                        </div>

                        {/* Grille de champs de formulaire (Nom, Prénom, etc.) */}
                        <div className="grid gap-6 md:grid-cols-2">
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-[100px]" /> {/* Label */}
                                <Skeleton className="h-10 w-full rounded-md" /> {/* Input */}
                            </div>
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-[100px]" />
                                <Skeleton className="h-10 w-full rounded-md" />
                            </div>
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-[80px]" />
                                <Skeleton className="h-10 w-full rounded-md" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bloc 2 : Section Sécurité (Mot de passe & Email) */}
                <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
                    <div className="flex flex-col space-y-1.5 p-6 border-b border-border/50">
                        <Skeleton className="h-6 w-[200px]" />
                        <Skeleton className="h-4 w-[350px]" />
                    </div>

                    <div className="p-6 space-y-6">
                        {/* Ligne d'action 1 (ex: Changement d'email) */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-lg border border-border/50 p-4">
                            <div className="space-y-2">
                                <Skeleton className="h-5 w-[120px]" />
                                <Skeleton className="h-4 w-[200px]" />
                            </div>
                            <Skeleton className="h-10 w-[140px] rounded-md shrink-0" /> {/* Bouton */}
                        </div>

                        {/* Ligne d'action 2 (ex: Changement de mot de passe) */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-lg border border-border/50 p-4">
                            <div className="space-y-2">
                                <Skeleton className="h-5 w-[140px]" />
                                <Skeleton className="h-4 w-[220px]" />
                            </div>
                            <Skeleton className="h-10 w-[140px] rounded-md shrink-0" /> {/* Bouton */}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}