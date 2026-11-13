// Partagé serveur et client (sans « use client » ni dépendance) : les pages
// marquent leurs blocs, ReturnToAnchor les retrouve après une reconnexion.

/** Ancre de bloc acceptée dans l'adresse de retour : lettres, chiffres, _ et -. */
export const RETURN_ANCHOR_PATTERN = /^[A-Za-z][\w-]{0,99}$/;

export function isReturnAnchor(value: unknown): value is string {
  return typeof value === "string" && RETURN_ANCHOR_PATTERN.test(value);
}

const RETURN_ANCHOR_CLASS =
  "scroll-mt-24 outline-none transition-colors duration-700 motion-reduce:transition-none data-returned:bg-accent";

/**
 * Propriétés d'un bloc vers lequel revenir après une reconnexion : id stable,
 * focus programmatique possible (sans entrer dans l'ordre de tabulation) et
 * mise en évidence brève pendant data-returned.
 */
export function returnAnchor(id: string, className?: string) {
  return {
    id,
    tabIndex: -1,
    "data-return-anchor": "",
    className: className ? `${RETURN_ANCHOR_CLASS} ${className}` : RETURN_ANCHOR_CLASS,
  } as const;
}
