import { createHash } from "node:crypto";
import type { PrismaClient } from "../src/generated/prisma/client";
import {
  PROJECT_LOGO_MAX_BYTES,
  PROJECT_LOGO_TYPES,
  sniffLogoType,
  type ProjectLogoType,
} from "./project-logo";

/**
 * Photo de profil WhatsApp des prospects.
 *
 * Evolution API renvoie une adresse signée de WhatsApp qui expire : l’image
 * est donc téléchargée et recopiée dans le stockage du projet, puis servie par
 * une route réservée à ses membres. L’adresse d’origine ne quitte jamais le
 * serveur. Chaque contact est vérifié au plus une fois par semaine pour ne
 * pas multiplier les appels à WhatsApp.
 */
export const CONTACT_AVATAR_REFRESH_MS = 7 * 24 * 60 * 60 * 1000;
export const CONTACT_AVATAR_MAX_BYTES = PROJECT_LOGO_MAX_BYTES;
/** Contacts vérifiés au plus par message reçu (un lot de webhook peut en contenir plusieurs). */
const AVATARS_PER_BATCH = 5;

const KEY_PATTERN =
  /^contact-avatars\/([^/]+)\/([^/]+)\/([\da-f]{32})\.(jpg|png|webp)$/;

export function contactAvatarKey(
  projectId: string,
  contactId: string,
  digest: string,
  type: ProjectLogoType,
) {
  return `contact-avatars/${projectId}/${contactId}/${digest}.${PROJECT_LOGO_TYPES[type]}`;
}

/** Clé valide et rattachée à ce contact de ce projet uniquement. */
export function isContactAvatarKey(
  projectId: string,
  contactId: string,
  key: string | null | undefined,
): key is string {
  const match = key ? KEY_PATTERN.exec(key) : null;
  return !!match && match[1] === projectId && match[2] === contactId;
}

/** Adresse servie à l’interface ; `v` change avec chaque nouvelle photo (cache). */
export function contactAvatarUrl(
  projectId: string,
  contactId: string,
  avatarKey: string | null | undefined,
) {
  if (!isContactAvatarKey(projectId, contactId, avatarKey)) return null;
  const version = KEY_PATTERN.exec(avatarKey)?.[3].slice(0, 8);
  return `/api/projects/${encodeURIComponent(projectId)}/contacts/${encodeURIComponent(contactId)}/avatar?v=${version}`;
}

/** Comptes individuels uniquement : ni groupes, ni listes de diffusion, ni statuts. */
export function isPersonJid(jid: string) {
  return /^[\w.-]{1,80}@(s\.whatsapp\.net|lid)$/.test(jid);
}

/**
 * Seules les images hébergées par WhatsApp sont téléchargées : une réponse
 * inattendue ne peut pas faire appeler une autre adresse par le serveur.
 */
export function isWhatsAppPictureUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 4096) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.port &&
      !url.username &&
      !url.password &&
      (url.hostname === "pps.whatsapp.net" ||
        url.hostname.endsWith(".whatsapp.net"))
    );
  } catch {
    return false;
  }
}

export type AvatarStorage = {
  put(key: string, bytes: Uint8Array, type: ProjectLogoType): Promise<void>;
  remove(key: string): Promise<void>;
};

export type AvatarDeps = {
  fetch: typeof fetch;
  storage: () => Promise<AvatarStorage>;
  evolution: () => { base: string; key: string } | null;
};

/** Stockage chargé à la demande : son module exige les variables MinIO. */
async function s3Storage(): Promise<AvatarStorage> {
  const [{ DeleteObjectCommand, PutObjectCommand }, { s3Client }] =
    await Promise.all([import("@aws-sdk/client-s3"), import("./storage")]);
  const Bucket = process.env.MINIO_BUCKET;
  return {
    async put(key, bytes, type) {
      await s3Client.send(
        new PutObjectCommand({ Bucket, Key: key, Body: bytes, ContentType: type }),
      );
    },
    async remove(key) {
      await s3Client.send(new DeleteObjectCommand({ Bucket, Key: key }));
    },
  };
}

const defaultDeps: AvatarDeps = {
  fetch: (...args) => fetch(...args),
  storage: s3Storage,
  evolution: () => {
    const base = process.env.EVOLUTION_API_URL?.replace(/\/+$/, "");
    const key = process.env.EVOLUTION_API_KEY;
    return base && key ? { base, key } : null;
  },
};

class AvatarUnavailable extends Error {}

/**
 * Adresse de la photo selon Evolution : `null` quand le prospect n’en a pas
 * ou la réserve à ses contacts ; une erreur quand Evolution ne répond pas.
 */
async function fetchPictureUrl(
  deps: AvatarDeps,
  instanceName: string,
  remoteJid: string,
) {
  const config = deps.evolution();
  if (!config) throw new AvatarUnavailable();
  const response = await deps.fetch(
    `${config.base}/chat/fetchProfilePictureUrl/${encodeURIComponent(instanceName)}`,
    {
      method: "POST",
      headers: { apikey: config.key, "Content-Type": "application/json" },
      body: JSON.stringify({ number: remoteJid }),
      signal: AbortSignal.timeout(8000),
    },
  );
  if (!response.ok) throw new AvatarUnavailable();
  const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  const url = body?.profilePictureUrl ?? body?.profilePicUrl ?? null;
  return isWhatsAppPictureUrl(url) ? url : null;
}

/** Télécharge l’image en refusant les redirections et tout fichier trop lourd. */
async function downloadPicture(deps: AvatarDeps, url: string) {
  const response = await deps.fetch(url, {
    redirect: "error",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok || !response.body) throw new AvatarUnavailable();
  const announced = Number(response.headers.get("content-length") || 0);
  if (announced > CONTACT_AVATAR_MAX_BYTES) return null;
  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = response.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > CONTACT_AVATAR_MAX_BYTES) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const type = sniffLogoType(bytes);
  return type ? { bytes, type } : null;
}

type Candidate = {
  id: string;
  remoteJid: string;
  avatarKey: string | null;
  avatarCheckedAt: Date | null;
};

/**
 * Met à jour la photo d’un contact. Les écritures passent par du SQL direct :
 * `updatedAt` reste inchangé, sinon la conversation remonterait en tête de liste.
 * Renvoie `true` si la photo affichée a changé.
 */
async function refreshOne(
  db: Pick<PrismaClient, "$executeRaw">,
  deps: AvatarDeps,
  projectId: string,
  instanceName: string,
  contact: Candidate,
) {
  // Réservation à l’horloge de la base : un seul traitement par contact et par
  // semaine, même si deux webhooks arrivent en même temps.
  const claimed = await db.$executeRaw`UPDATE contact SET "avatarCheckedAt" = (clock_timestamp() AT TIME ZONE 'UTC')
    WHERE id = ${contact.id} AND "projectId" = ${projectId}
      AND ("avatarCheckedAt" IS NULL OR "avatarCheckedAt" < (clock_timestamp() AT TIME ZONE 'UTC') - interval '7 days')`;
  if (!claimed) return false;
  const previous = isContactAvatarKey(projectId, contact.id, contact.avatarKey)
    ? contact.avatarKey
    : null;
  try {
    const url = await fetchPictureUrl(deps, instanceName, contact.remoteJid);
    const picture = url ? await downloadPicture(deps, url) : null;
    if (!picture) {
      // Plus de photo visible : on n’affiche plus l’ancienne.
      if (!previous) return false;
      await db.$executeRaw`UPDATE contact SET "avatarKey" = NULL WHERE id = ${contact.id} AND "avatarKey" = ${previous}`;
      await (await deps.storage()).remove(previous).catch(() => undefined);
      return true;
    }
    const digest = createHash("sha256").update(picture.bytes).digest("hex").slice(0, 32);
    const key = contactAvatarKey(projectId, contact.id, digest, picture.type);
    // Même image qu’avant : rien à recopier.
    if (key === previous) return false;
    const storage = await deps.storage();
    await storage.put(key, picture.bytes, picture.type);
    const saved = await db.$executeRaw`UPDATE contact SET "avatarKey" = ${key} WHERE id = ${contact.id} AND "projectId" = ${projectId}`;
    if (!saved) {
      // Contact supprimé entre-temps : la copie ne doit pas rester.
      await storage.remove(key).catch(() => undefined);
      return false;
    }
    if (previous) await storage.remove(previous).catch(() => undefined);
    return true;
  } catch {
    // Panne passagère (Evolution, WhatsApp ou stockage) : nouvel essai possible dans une heure.
    await db.$executeRaw`UPDATE contact
      SET "avatarCheckedAt" = (clock_timestamp() AT TIME ZONE 'UTC') - interval '7 days' + interval '1 hour'
      WHERE id = ${contact.id} AND "projectId" = ${projectId}`;
    console.error("[avatar] Photo de profil indisponible.");
    return false;
  }
}

/**
 * Vérifie la photo des prospects qui viennent d’écrire, quand elle n’a jamais
 * été vérifiée ou date de plus d’une semaine. Appelée après la réponse au
 * webhook : elle ne retarde ni l’enregistrement du message ni la réponse de l’IA.
 * Renvoie le nombre de photos changées.
 */
export async function refreshContactAvatars(
  db: Pick<PrismaClient, "contact" | "project" | "$executeRaw">,
  input: { projectId: string; instanceName: string; remoteJids: string[] },
  deps: AvatarDeps = defaultDeps,
) {
  const remoteJids = [...new Set(input.remoteJids.filter(isPersonJid))].slice(0, 50);
  if (!remoteJids.length) return 0;
  const project = await db.project.findUnique({
    where: { id: input.projectId },
    select: { instanceName: true, instanceStatus: true, deletionPending: true },
  });
  if (
    !project ||
    project.deletionPending ||
    project.instanceStatus !== "connected" ||
    project.instanceName !== input.instanceName
  )
    return 0;
  const staleBefore = new Date(Date.now() - CONTACT_AVATAR_REFRESH_MS);
  const contacts = await db.contact.findMany({
    where: {
      projectId: input.projectId,
      remoteJid: { in: remoteJids },
      OR: [{ avatarCheckedAt: null }, { avatarCheckedAt: { lt: staleBefore } }],
    },
    select: { id: true, remoteJid: true, avatarKey: true, avatarCheckedAt: true },
    take: AVATARS_PER_BATCH,
  });
  let changed = 0;
  for (const contact of contacts)
    if (await refreshOne(db, deps, input.projectId, input.instanceName, contact))
      changed += 1;
  return changed;
}

/** Retire la copie d’une photo ; un échec est rattrapé par le nettoyage du stockage. */
export async function removeContactAvatar(
  key: string | null | undefined,
  storage: () => Promise<AvatarStorage> = s3Storage,
) {
  if (!key || !KEY_PATTERN.test(key)) return;
  try {
    await (await storage()).remove(key);
  } catch {
    console.error("[avatar] Photo de profil à supprimer plus tard.");
  }
}
