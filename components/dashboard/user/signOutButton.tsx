"use client"
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Loader2, LogOutIcon } from 'lucide-react';

import { useSignOut } from './recent-session';

function SignOutButton({ variant, className }: { variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"; className?: string }) {
    // Le cookie est effacé avant de quitter la page : pas de retour possible
    // dans l’espace connecté, ni de page connectée gardée en cache.
    const { signingOut, signOutAndLeave } = useSignOut();
    return (
        <Button
            type="button"
            onClick={(event) => {
                // Dans le menu du compte : il reste ouvert pendant la déconnexion.
                event.preventDefault();
                if (!signingOut) void signOutAndLeave();
            }}
            disabled={signingOut}
            aria-busy={signingOut}
            className={cn("cursor-pointer", className)}
            variant={variant || "destructive"}
        >
            {signingOut ? <Loader2 className="animate-spin" aria-hidden="true" /> : <LogOutIcon aria-hidden="true" />}
            {signingOut ? "Déconnexion…" : "Se déconnecter"}
        </Button>
    )
}

export default SignOutButton
