import prisma from "@/lib/prisma";

/**
 * État du site pour le contrôle du conteneur et le script de déploiement :
 * 200 si le serveur répond et joint la base, 503 sinon. Aucun détail n'est
 * renvoyé. Le résultat est gardé 5 secondes : une rafale de requêtes ne
 * touche la base qu'une fois.
 */
const FRESH_MS = 5_000;
const TIMEOUT_MS = 3_000;
let last: { at: number; ok: boolean } | null = null;
let pending: Promise<boolean> | null = null;

async function databaseReachable() {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("HEALTH_TIMEOUT")), TIMEOUT_MS);
      }),
    ]);
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function GET() {
  if (!last || Date.now() - last.at > FRESH_MS) {
    pending ??= databaseReachable().finally(() => (pending = null));
    last = { at: Date.now(), ok: await pending };
  }
  return Response.json(
    { ok: last.ok },
    { status: last.ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
