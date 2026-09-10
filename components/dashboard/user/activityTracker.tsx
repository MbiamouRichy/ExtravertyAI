"use client";

import { useEffect } from "react";
import { updateUserActivity } from "@/app/actions/user";

export function ActivityTracker() {
    useEffect(() => {
        // 1. On signale qu'on est en ligne dès le chargement de la page
        updateUserActivity();

        // 2. On configure un ping toutes les 3 minutes (180 000 ms)
        const intervalId = setInterval(() => {
            updateUserActivity();
        }, 3 * 60 * 1000);

        // Nettoyage si l'utilisateur quitte la page
        return () => clearInterval(intervalId);
    }, []);

    // Ce composant n'affiche rien visuellement
    return null;
}