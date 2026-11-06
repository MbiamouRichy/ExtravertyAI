/**
 * Interface prototypes under /maquettes: served in development and on Vercel
 * previews only, never in production (any other build answers 404).
 */
export function maquettesEnabled(env: Record<string, string | undefined> = process.env) {
  return env.NODE_ENV === "development" || env.VERCEL_ENV === "preview";
}

export function isMaquettesPath(pathname: string) {
  return pathname === "/maquettes" || pathname.startsWith("/maquettes/");
}
