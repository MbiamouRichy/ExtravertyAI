import type { BetterAuthOptions } from "better-auth";

/**
 * Limites de débit des routes d’authentification, par adresse IP.
 *
 * Compteurs en base, pas en mémoire : sur Vercel, chaque instance gardait les
 * siens, remis à zéro à chaque démarrage, et une rafale répartie entre
 * instances passait sans limite. La table `rate_limit` est partagée par
 * toutes les instances.
 *
 * Restent les règles de Better Auth : 3 essais par 10 s pour la connexion,
 * 3 codes envoyés ou vérifiés par minute. S’y ajoutent ici :
 * - un plafond horaire pour la création de compte par mot de passe ;
 * - aucune limite pour la lecture de session, appelée à chaque page et sans
 *   intérêt pour deviner un mot de passe ou un code.
 *
 * Activées en production seulement, préversion comprise (défaut de Better Auth).
 */
export const AUTH_RATE_LIMIT = {
  storage: "database",
  customRules: {
    "/sign-up/email": { window: 60 * 60, max: 10 },
    "/get-session": false,
  },
} satisfies BetterAuthOptions["rateLimit"];
