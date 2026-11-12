import { z } from "zod";
import type { PrismaClient } from "../src/generated/prisma/client";
import {
  MAX_MEDIA_BYTES,
  MEDIA_TYPES,
  mediaKind,
  safeMediaFilename,
  type ChatAttachment,
  type MediaMime,
} from "./chat-media";
import {
  readLimitedBody,
  signMediaTicket,
  validateMediaBytes,
} from "./chat-media-server";
import { can, rolesWith } from "./project-permissions";
import { projectBillingStatus } from "./project-status";
import {
  StorageQuotaError,
  releaseStorage,
  reserveStorage,
} from "./storage-quota";

/** Stockage des pièces jointes (MinIO en production, faux stockage en test). */
export type MediaStorage = {
  put(file: {
    key: string;
    bytes: Buffer;
    mime: MediaMime;
    filename: string;
  }): Promise<void>;
  remove(key: string): Promise<void>;
};

export type ChatMediaUploadResult =
  | { status: 200; body: ChatAttachment }
  | { status: 400 | 404 | 409 | 413 | 415 | 503; body: { error: string } };

export type ChatMediaUploadInput = {
  userId: string;
  projectId: string;
  /** Paramètre `requestId` de l’URL : lie le ticket à un seul envoi. */
  requestId: string | null;
  /** En-têtes du navigateur : indicatifs, revérifiés sur le contenu. */
  contentType: string | null;
  contentLength: string | null;
  filename: string | null;
  body: ReadableStream<Uint8Array> | null;
};

const MAX_FILENAME_HEADER = 1024;
const TICKET_LIFETIME_MS = 24 * 60 * 60 * 1000;

/** `X-File-Name` (encodé par le navigateur) ; illisible ou trop long : ignoré. */
export function decodeFilenameHeader(value: string | null) {
  if (!value || value.length > MAX_FILENAME_HEADER) return "";
  try {
    return decodeURIComponent(value);
  } catch {
    return "";
  }
}

const failure = (
  status: Exclude<ChatMediaUploadResult["status"], 200>,
  error: string,
): ChatMediaUploadResult => ({ status, body: { error } });

/**
 * Seule vraie barrière des pièces jointes de la messagerie : rôle et projet,
 * type réel lu dans les octets (jamais l’extension ni le type annoncé),
 * taille, quota de l’offre réservé sous verrou, nom de fichier réécrit.
 * L’appelant a déjà vérifié la session et l’origine de la requête.
 */
export async function acceptChatMediaUpload(
  db: PrismaClient,
  storage: MediaStorage,
  input: ChatMediaUploadInput,
): Promise<ChatMediaUploadResult> {
  const { userId, projectId } = input;
  const requestId = z.string().uuid().safeParse(input.requestId);
  if (!z.string().cuid().safeParse(projectId).success || !requestId.success)
    return failure(400, "Demande invalide.");

  const member = await db.projectMembership.findUnique({
    where: { userId_projectId: { userId, projectId } },
    include: { project: true },
  });
  // Même réponse pour un projet inconnu, d’un autre compte ou interdit au rôle.
  if (
    !member ||
    member.project.deletionPending ||
    !can(member.role, "conversations.handle")
  )
    return failure(404, "Projet indisponible.");
  if (
    !["active", "trialing"].includes(projectBillingStatus(member.project)) ||
    member.project.instanceStatus !== "connected"
  )
    return failure(409, "Un projet actif et connecté à WhatsApp est requis.");

  const mime = (input.contentType?.split(";")[0] ?? "").trim().toLowerCase();
  if (!Object.hasOwn(MEDIA_TYPES, mime))
    return failure(415, "Format non pris en charge.");
  if (Number(input.contentLength) > MAX_MEDIA_BYTES)
    return failure(413, "Le fichier dépasse 4 Mo.");

  let bytes: Buffer;
  try {
    bytes = await readLimitedBody(input.body, MAX_MEDIA_BYTES);
    // Signature binaire du type annoncé : un HTML renommé en .png est refusé.
    validateMediaBytes(bytes, mime);
  } catch (error) {
    if (error instanceof Error && error.message === "MEDIA_TOO_LARGE")
      return failure(413, "Le fichier dépasse 4 Mo.");
    if (
      error instanceof Error &&
      ["MEDIA_INVALID", "EMPTY_BODY"].includes(error.message)
    )
      return failure(
        400,
        "Ce fichier est vide, endommagé ou d’un autre format que celui annoncé.",
      );
    return failure(503, "Le fichier n’a pas pu être importé. Réessayez.");
  }

  const filename = safeMediaFilename(
    decodeFilenameHeader(input.filename),
    mime,
  );
  // Clé choisie par le serveur : le nom du navigateur n’y entre jamais.
  const key = `chat-media/${projectId}/${crypto.randomUUID()}.${MEDIA_TYPES[mime]}`;

  try {
    const token = signMediaTicket({
      key,
      mime,
      projectId,
      userId,
      requestId: requestId.data,
      expires: Date.now() + TICKET_LIFETIME_MS,
    });
    // Quota de l’offre : place réservée sous le verrou du projet, avant
    // l’envoi vers le stockage, et rendue si cet envoi échoue.
    try {
      await db.$transaction(async (tx) => {
        const [locked] = await tx.$queryRaw<{ plan: string }[]>`
          SELECT plan::text AS plan FROM project WHERE id = ${projectId} FOR UPDATE`;
        await reserveStorage(tx, {
          projectId,
          plan: locked?.plan,
          key,
          bytes: bytes.length,
        });
      });
    } catch (error) {
      if (error instanceof StorageQuotaError)
        return failure(413, error.message);
      throw error;
    }
    try {
      await storage.put({ key, bytes, mime, filename });
    } catch (error) {
      await releaseStorage(db, key).catch(() => undefined);
      throw error;
    }
    // Rôle retiré ou suppression demandée pendant l’envoi : rien ne reste.
    const stillAllowed = await db.projectMembership.findFirst({
      where: {
        userId,
        projectId,
        role: { in: rolesWith("conversations.handle") },
        project: { deletionPending: false },
      },
      select: { id: true },
    });
    if (!stillAllowed) {
      await storage.remove(key).catch(() => undefined);
      await releaseStorage(db, key).catch(() => undefined);
      return failure(404, "Projet indisponible.");
    }
    return {
      status: 200,
      body: { token, type: mediaKind(mime), requestId: requestId.data },
    };
  } catch {
    return failure(503, "Le fichier n’a pas pu être importé. Réessayez.");
  }
}

/** Stockage MinIO, chargé à la demande (les tests n’en ont pas besoin). */
export const s3MediaStorage: MediaStorage = {
  async put({ key, bytes, mime, filename }) {
    const { s3Client } = await import("./storage");
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    await s3Client.send(
      new PutObjectCommand({
        Bucket: process.env.MINIO_BUCKET,
        Key: key,
        Body: bytes,
        ContentType: mime,
        Metadata: { filename: encodeURIComponent(filename) },
      }),
      { abortSignal: AbortSignal.timeout(20_000) },
    );
  },
  async remove(key) {
    const { s3Client } = await import("./storage");
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    await s3Client.send(
      new DeleteObjectCommand({ Bucket: process.env.MINIO_BUCKET, Key: key }),
      { abortSignal: AbortSignal.timeout(15_000) },
    );
  },
};
