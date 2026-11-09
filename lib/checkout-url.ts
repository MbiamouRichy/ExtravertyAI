/**
 * Seule sortie autorisée de l’application pour payer : la page hébergée de
 * Polar, en https, sans port ni identifiants dans l’adresse.
 */
export function safeCheckoutUrl(value: string) {
  try {
    const url = new URL(value);
    const trusted =
      url.hostname === "polar.sh" || url.hostname.endsWith(".polar.sh");
    if (url.protocol !== "https:" || !trusted || url.port || url.username || url.password)
      return null;
    return url.href;
  } catch {
    return null;
  }
}
