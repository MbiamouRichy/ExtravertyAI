import "server-only";

import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth-server";
import { checkAdminSession, type AdminCheck } from "@/lib/admin-access";

// Session relue en base (sans cache de cookie) : une session révoquée ou un
// e-mail retiré de la liste perd l'accès immédiatement.
const readAdminCheck = cache(async (recent: boolean): Promise<AdminCheck> => {
  const session = await getSession({ fresh: true });
  return checkAdminSession(session, { recent });
});

/**
 * Pages et layouts : un 404 pour toute personne hors liste, connectée ou non,
 * pour ne pas révéler l'existence du back-office.
 */
export async function requireAdminPage() {
  const check = await readAdminCheck(false);
  if (!check.ok) notFound();
  return check.admin;
}

/**
 * Les métadonnées sont résolues même quand le layout renvoie un 404 : sans
 * accès, aucun titre ne doit trahir le back-office.
 */
export async function adminMetadata(title: string): Promise<Metadata> {
  const check = await readAdminCheck(false);
  // Sans accès, le 404 de Next ajoute déjà « noindex ».
  return check.ok
    ? { title: `${title} | Back-office`, robots: { index: false, follow: false, nocache: true } }
    : {};
}

/** Server Actions : à appeler en premier, avant toute lecture des données. */
export async function getAdminForAction(options: { recent?: boolean } = {}) {
  return readAdminCheck(options.recent ?? false);
}
