import { safeAuthCallback } from "./auth-redirects";

/**
 * Entrée dans l’application juste après l’ouverture d’une session.
 *
 * En production, Next.js précharge les liens affichés. Un lien vers l’espace
 * client vu avant la connexion (« Mon espace » du pied de page, par exemple)
 * a reçu du proxy la redirection vers /sign-in?callbackUrl=/projects, et le
 * routeur client la garde en mémoire : une navigation client (router.push)
 * la rejouerait et ramènerait sur la connexion. Un chargement complet repart
 * du serveur, avec le cookie de la nouvelle session, et vide ce cache.
 *
 * `replace` : le formulaire de connexion ne reste pas dans l’historique.
 * La promesse ne se résout jamais : l’appelant qui l’attend garde son état
 * d’attente jusqu’au départ de la page, sans réactiver le formulaire.
 */
export function enterSignedInApp(
  destination: string,
  location: Pick<Location, "replace"> = window.location,
): Promise<never> {
  // Chemin relatif revalidé ici aussi : jamais d’adresse externe.
  location.replace(safeAuthCallback(destination));
  return new Promise<never>(() => {});
}
