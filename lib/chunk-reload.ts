/**
 * Après un déploiement, un onglet ouvert sur l’ancienne version peut demander
 * un fichier JavaScript qui n’existe plus (ChunkLoadError). Recharger la page
 * récupère la nouvelle version. Une seule fois par fenêtre de temps : si le
 * fichier manque toujours, la page d’erreur habituelle prend le relais plutôt
 * qu’une boucle de rechargements.
 */

export const CHUNK_RELOAD_KEY = "extraverty:chunk-reload-at";
export const CHUNK_RELOAD_WINDOW_MS = 5 * 60 * 1000;

const CHUNK_MESSAGES = [
  /Loading (CSS )?chunk [\w-]+ failed/i,
  /Failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /Importing a module script failed/i,
];

/** Erreur due à un fichier de l’application introuvable. */
export function isChunkLoadError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { name, message } = error as { name?: unknown; message?: unknown };
  if (name === "ChunkLoadError") return true;
  return typeof message === "string" && CHUNK_MESSAGES.some((pattern) => pattern.test(message));
}

type Storage = Pick<globalThis.Storage, "getItem" | "setItem">;

/**
 * Indique s’il faut recharger et, si oui, note l’heure du rechargement. Sans
 * stockage utilisable, rien n’est rechargé : la limite d’une fois ne pourrait
 * pas être garantie.
 */
export function claimChunkReload(storage: Storage | null, now: number = Date.now()): boolean {
  if (!storage) return false;
  try {
    const last = Number(storage.getItem(CHUNK_RELOAD_KEY));
    if (Number.isFinite(last) && last > 0 && now - last >= 0 && now - last < CHUNK_RELOAD_WINDOW_MS)
      return false;
    storage.setItem(CHUNK_RELOAD_KEY, String(now));
    return storage.getItem(CHUNK_RELOAD_KEY) === String(now);
  } catch {
    return false;
  }
}

/** Recharge la page une fois si `error` est une ChunkLoadError. */
export function reloadOnceAfterChunkError(error: unknown): boolean {
  if (typeof window === "undefined" || !isChunkLoadError(error)) return false;
  let storage: Storage | null = null;
  try {
    storage = window.sessionStorage;
  } catch {
    storage = null;
  }
  if (!claimChunkReload(storage)) return false;
  window.location.reload();
  return true;
}
