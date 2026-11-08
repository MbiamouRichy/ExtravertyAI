import { createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { parsePhoneNumberFromString } from "libphonenumber-js/max";
import type { Prisma, PrismaClient } from "../src/generated/prisma/client";
import { needsInitialCheckout } from "./billing-display";
import { can } from "./project-permissions";
import { hashTrialNumber, trialNumberDigits } from "./trial-eligibility";

/**
 * Preuve qu’un numéro WhatsApp appartient à l’utilisateur, avant que le projet
 * ne soit enregistré.
 *
 * Un code à 6 chiffres part par WhatsApp, depuis le numéro d’ExtravertyAI, vers
 * le numéro saisi. Le bon code fait de cet envoi une preuve, valable 30 minutes,
 * qui permet d’enregistrer un seul projet sur ce numéro (et d’y réserver l’essai).
 *
 * - Le code n’est jamais conservé en clair (empreinte HMAC liée à l’envoi).
 * - Il expire au bout de 10 minutes et accepte 5 essais.
 * - Les envois sont limités en base : par compte et par numéro (tous comptes
 *   confondus), pour qu’on ne puisse ni deviner un code ni inonder le
 *   téléphone de quelqu’un, même en changeant de numéro à chaque essai.
 */
export const CODE_TTL_MS = 10 * 60 * 1000;
export const MAX_ATTEMPTS = 5;
export const RESEND_COOLDOWN_MS = 60 * 1000;
/** Délai pour enregistrer le projet une fois le numéro prouvé. */
export const PROOF_TTL_MS = 30 * 60 * 1000;
const PER_USER_PER_HOUR = 5;
const PER_NUMBER_PER_DAY = 10;
const PER_USER_PER_DAY = 15;
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export class PhoneVerificationError extends Error {
  constructor(
    message: string,
    readonly code:
      | "FORBIDDEN"
      | "NOT_NEEDED"
      | "ALREADY_VERIFIED"
      | "INVALID_NUMBER"
      | "UNAVAILABLE"
      | "NOT_ON_WHATSAPP"
      | "SEND_FAILED"
      | "RATE_LIMITED"
      | "EXPIRED"
      | "TOO_MANY_ATTEMPTS"
      | "WRONG_CODE",
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
  }
}

/** Envoi WhatsApp du message, aux chiffres E.164 du destinataire. */
export type OtpSender = (digits: string, text: string) => Promise<void>;

/**
 * Numéro à prouver : celui saisi dans le formulaire de création, ou celui d’un
 * projet déjà enregistré dont le paiement initial n’a jamais abouti.
 */
export type VerificationTarget = { numero: string } | { projectId: string };

type Db = Pick<
  PrismaClient,
  "projectMembership" | "phoneVerification" | "project" | "$transaction"
>;
type ProofDb = Pick<PrismaClient | Prisma.TransactionClient, "phoneVerification">;

function secret() {
  const value = process.env.BETTER_AUTH_SECRET;
  if (!value) throw new Error("BETTER_AUTH_SECRET_MISSING");
  return value;
}

export function hashVerificationCode(verificationId: string, code: string) {
  return createHmac("sha256", secret())
    .update(`phone-otp:${verificationId}:${code}`)
    .digest("hex");
}

/** Six chiffres tirés au hasard cryptographique, zéros en tête compris. */
export function generateVerificationCode() {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function verificationMessage(code: string) {
  return `ExtravertyAI : votre code de vérification est ${code}. Il expire dans 10 minutes. Ne le communiquez à personne.`;
}

/** « +241 66 00 00 39 » : le numéro en entier, pour repérer une faute de frappe. */
export function formatVerificationNumber(numero: string) {
  const phone = parsePhoneNumberFromString(
    numero.startsWith("+") ? numero : `+${numero}`,
  );
  return phone?.formatInternational() ?? `+${numero.replace(/\D/g, "")}`;
}

/** L’envoi par WhatsApp est-il configuré sur ce serveur ? */
export function whatsAppVerificationAvailable() {
  return Boolean(
    process.env.EVOLUTION_API_URL &&
      process.env.EVOLUTION_API_KEY &&
      process.env.OTP_WHATSAPP_INSTANCE,
  );
}

/** Envoi depuis le numéro d’ExtravertyAI, connecté à Evolution comme un projet. */
export const sendWhatsAppCode: OtpSender = async (digits, text) => {
  const base = process.env.EVOLUTION_API_URL!.replace(/\/+$/, "");
  const response = await fetch(
    `${base}/message/sendText/${encodeURIComponent(process.env.OTP_WHATSAPP_INSTANCE!)}`,
    {
      method: "POST",
      headers: {
        apikey: process.env.EVOLUTION_API_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ number: digits, text }),
      signal: AbortSignal.timeout(10000),
    },
  );
  if (response.ok) return;
  const body = await response.text().catch(() => "");
  // Evolution répond « exists: false » quand le numéro n’a pas de compte WhatsApp.
  if (/"exists"\s*:\s*false/.test(body))
    throw new PhoneVerificationError(
      "Ce numéro n’a pas de compte WhatsApp. Vérifiez-le ou saisissez un autre numéro.",
      "NOT_ON_WHATSAPP",
    );
  throw new Error(`OTP_WHATSAPP_HTTP_${response.status}`);
};

/** Projet dont ce membre peut prouver le numéro : celui qui gère son paiement. */
async function loadProject(db: Db, projectId: string, userId: string) {
  const membership = await db.projectMembership.findUnique({
    where: { userId_projectId: { userId, projectId } },
    select: {
      role: true,
      project: {
        select: {
          numero: true,
          status: true,
          deletionPending: true,
          stripeCustomerId: true,
          stripeSubscriptionId: true,
          numeroVerifiedAt: true,
        },
      },
    },
  });
  if (!membership || !can(membership.role, "billing.manage"))
    throw new PhoneVerificationError(
      "Vous n’avez pas les droits nécessaires sur ce projet.",
      "FORBIDDEN",
    );
  const { project } = membership;
  if (project.deletionPending || !needsInitialCheckout(project))
    throw new PhoneVerificationError(
      "Ce numéro n’a plus besoin d’être vérifié.",
      "NOT_NEEDED",
    );
  if (project.numeroVerifiedAt)
    throw new PhoneVerificationError("Ce numéro est déjà vérifié.", "ALREADY_VERIFIED");
  return project;
}

function digitsOf(numero: string) {
  try {
    return trialNumberDigits(numero);
  } catch {
    throw new PhoneVerificationError(
      "Saisissez un numéro international valide.",
      "INVALID_NUMBER",
    );
  }
}

/**
 * Envoie un nouveau code. Le code précédent du compte est annulé, quel que soit
 * son numéro : un seul code valable à la fois.
 */
export async function sendVerificationCode(
  db: Db,
  input: { userId: string; target: VerificationTarget },
  send: OtpSender = sendWhatsAppCode,
  available = whatsAppVerificationAvailable(),
) {
  const numero =
    "projectId" in input.target
      ? (await loadProject(db, input.target.projectId, input.userId)).numero
      : input.target.numero;
  const digits = digitsOf(numero);
  if (!available)
    throw new PhoneVerificationError(
      "La vérification par WhatsApp est momentanément indisponible. Réessayez plus tard.",
      "UNAVAILABLE",
    );
  const numberHash = hashTrialNumber(digits);
  const code = generateVerificationCode();
  const verification = await db.$transaction(async (tx) => {
    // Verrou du compte : deux clics simultanés ne passent pas tous deux les limites.
    await tx.$queryRaw`SELECT id FROM "user" WHERE id = ${input.userId} FOR UPDATE`;
    const now = Date.now();
    // Délai avant de renvoyer au même numéro ; un numéro corrigé part tout de suite.
    const last = await tx.phoneVerification.findFirst({
      where: { userId: input.userId, numberHash },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    const wait = last ? last.createdAt.getTime() + RESEND_COOLDOWN_MS - now : 0;
    if (wait > 0)
      throw new PhoneVerificationError(
        "Patientez avant de demander un nouveau code.",
        "RATE_LIMITED",
        Math.ceil(wait / 1000),
      );
    const [perHour, perNumber, perDay] = await Promise.all([
      tx.phoneVerification.count({
        where: { userId: input.userId, createdAt: { gte: new Date(now - HOUR) } },
      }),
      tx.phoneVerification.count({
        where: { numberHash, createdAt: { gte: new Date(now - DAY) } },
      }),
      tx.phoneVerification.count({
        where: { userId: input.userId, createdAt: { gte: new Date(now - DAY) } },
      }),
    ]);
    if (perHour >= PER_USER_PER_HOUR)
      throw new PhoneVerificationError(
        "Trop de codes demandés. Réessayez dans une heure.",
        "RATE_LIMITED",
        3600,
      );
    if (perNumber >= PER_NUMBER_PER_DAY || perDay >= PER_USER_PER_DAY)
      throw new PhoneVerificationError(
        "Trop de codes demandés aujourd’hui. Réessayez demain.",
        "RATE_LIMITED",
        86400,
      );
    await tx.phoneVerification.updateMany({
      where: { userId: input.userId, verifiedAt: null, expiresAt: { gt: new Date(now) } },
      data: { expiresAt: new Date(now) },
    });
    const id = randomUUID();
    return tx.phoneVerification.create({
      data: {
        id,
        userId: input.userId,
        numberHash,
        codeHash: hashVerificationCode(id, code),
        expiresAt: new Date(now + CODE_TTL_MS),
      },
      select: { id: true, expiresAt: true, createdAt: true },
    });
  });
  try {
    await send(digits, verificationMessage(code));
  } catch (error) {
    // Rien n’est parti : ce code n’existe pas et ne compte pas dans les limites.
    await db.phoneVerification.delete({ where: { id: verification.id } }).catch(() => undefined);
    if (error instanceof PhoneVerificationError) throw error;
    console.error("[otp] Envoi du code par WhatsApp impossible.");
    throw new PhoneVerificationError(
      "Le code n’a pas pu être envoyé par WhatsApp. Réessayez dans quelques instants.",
      "SEND_FAILED",
    );
  }
  return {
    verificationId: verification.id,
    expiresAt: verification.expiresAt,
    resendAt: new Date(verification.createdAt.getTime() + RESEND_COOLDOWN_MS),
  };
}

/**
 * Vérifie le code saisi. Chaque essai est compté avant la comparaison, en
 * temps constant ; un code juste fait de l’envoi une preuve du numéro.
 */
export async function confirmVerificationCode(
  db: Pick<PrismaClient, "phoneVerification">,
  input: { userId: string; verificationId: string; code: string },
) {
  const latest = await db.phoneVerification.findFirst({
    where: { id: input.verificationId, userId: input.userId },
    select: { id: true, codeHash: true, attempts: true, expiresAt: true, verifiedAt: true },
  });
  // Double envoi du formulaire : la preuve existe déjà.
  if (latest?.verifiedAt) return { verificationId: latest.id };
  if (!latest || latest.expiresAt.getTime() <= Date.now())
    throw new PhoneVerificationError(
      "Ce code a expiré. Demandez-en un nouveau.",
      "EXPIRED",
    );
  const counted = await db.phoneVerification.updateMany({
    where: { id: latest.id, verifiedAt: null, attempts: { lt: MAX_ATTEMPTS } },
    data: { attempts: { increment: 1 } },
  });
  if (!counted.count)
    throw new PhoneVerificationError(
      "Trop d’essais. Demandez un nouveau code.",
      "TOO_MANY_ATTEMPTS",
    );
  const expected = Buffer.from(latest.codeHash, "hex");
  const received = Buffer.from(
    /^\d{6}$/.test(input.code) ? hashVerificationCode(latest.id, input.code) : "",
    "hex",
  );
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    const left = MAX_ATTEMPTS - latest.attempts - 1;
    throw new PhoneVerificationError(
      left > 0
        ? `Code incorrect. ${left === 1 ? "Il vous reste 1 essai." : `Il vous reste ${left} essais.`}`
        : "Code incorrect. Demandez un nouveau code.",
      left > 0 ? "WRONG_CODE" : "TOO_MANY_ATTEMPTS",
    );
  }
  await db.phoneVerification.updateMany({
    where: { id: latest.id, verifiedAt: null },
    data: { verifiedAt: new Date() },
  });
  return { verificationId: latest.id };
}

type ProofInput = { verificationId: string; userId: string; numero: string };

function proofWhere(input: ProofInput) {
  return {
    id: input.verificationId,
    userId: input.userId,
    numberHash: hashTrialNumber(input.numero),
    consumedAt: null,
    verifiedAt: { gte: new Date(Date.now() - PROOF_TTL_MS) },
  };
}

/** Preuve encore utilisable de ce numéro par ce compte, sans la consommer. */
export async function usableNumberProof(db: ProofDb, input: ProofInput) {
  return db.phoneVerification.findFirst({
    where: proofWhere(input),
    select: { verifiedAt: true },
  });
}

/** Consomme la preuve pour ce projet ; faux si elle a expiré ou déjà servi. */
export async function consumeNumberProof(
  db: ProofDb,
  input: ProofInput & { projectId: string },
) {
  const { count } = await db.phoneVerification.updateMany({
    where: proofWhere(input),
    data: { consumedAt: new Date(), projectId: input.projectId },
  });
  return count === 1;
}

/**
 * Rend la preuve réutilisable quand le projet qu’elle a créé est annulé (paiement
 * impossible à préparer) : l’utilisateur réessaie sans nouveau code.
 */
export async function releaseNumberProof(
  db: ProofDb,
  input: { verificationId: string; userId: string },
) {
  await db.phoneVerification.updateMany({
    where: { id: input.verificationId, userId: input.userId, projectId: null },
    data: { consumedAt: null },
  });
}
