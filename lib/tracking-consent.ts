/**
 * Refus du suivi exprimé par le navigateur (Global Privacy Control ou Do Not
 * Track). Partagé par la mesure d’audience et PostHog : aucun des deux ne
 * démarre quand le visiteur l’a demandé. Hors navigateur, rien n’est refusé
 * puisque rien n’est mesuré.
 */
export function browserRefusesTracking(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return nav.globalPrivacyControl === true || nav.doNotTrack === "1";
}
