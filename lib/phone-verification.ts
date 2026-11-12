import { createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { parsePhoneNumberFromString } from "libphonenumber-js/max";
import { z } from "zod";
import type { Prisma, PrismaClient } from "../src/generated/prisma/client";
import { needsInitialCheckout } from "./billing-display";
import { can } from "./project-permissions";
import { hashTrialNumber, trialNumberDigits } from "./trial-eligibility";
import { alternateWhatsAppDigits } from "./whatsapp-number";

/**
 * Preuve qu’un numéro WhatsApp appartient à l’utilisateur, avant que le projet
 * ne soit enregistré. Deux façons, au choix de l’utilisateur :
 *
 * - par défaut, le client envoie lui-même un code depuis son WhatsApp vers le
 *   numéro d’ExtravertyAI (vérification inversée) : c’est WhatsApp qui garantit
 *   l’expéditeur, et notre numéro n’écrit jamais en premier à un inconnu ;
 * - en secours, un code part du numéro d’ExtravertyAI et le client le recopie.
 *
 * Une fois prouvé, le numéro permet pendant 30 minutes d’enregistrer un seul
 * projet (et d’y réserver l’essai).
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
/** Codes à envoyer soi-même : rien ne part, la limite évite seulement les abus. */
const INBOUND_STARTS_PER_HOUR = 20;
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

/** Numéro WhatsApp d’ExtravertyAI, auquel le client envoie son code (chiffres E.164). */
function otpNumberDigits() {
  const digits = process.env.OTP_WHATSAPP_NUMBER?.replace(/\D/g, "") ?? "";
  return /^[1-9]\d{7,14}$/.test(digits) ? digits : null;
}

/** La vérification inversée est-elle configurée (instance branchée et numéro connu) ? */
export function inboundVerificationAvailable() {
  return whatsAppVerificationAvailable() && otpNumberDigits() !== null;
}

/** Instance Evolution du numéro d’ExtravertyAI (aucun projet ne l’utilise). */
export function isOtpInstance(instance: string) {
  const name = process.env.OTP_WHATSAPP_INSTANCE;
  return !!name && instance === name;
}

/** Message prérempli que le client envoie depuis son WhatsApp. */
export function inboundMessage(code: string) {
  return `Bonjour ExtravertyAI, voici mon code de vérification : ${code}`;
}

/** Réponses du numéro d’ExtravertyAI, dans la conversation ouverte par le client. */
export const INBOUND_REPLIES = {
  verified:
    "✅ Numéro vérifié. Revenez sur ExtravertyAI : la création de votre projet continue automatiquement.",
  unknown:
    "Ce code n’est pas valable pour ce numéro, ou il a expiré. Envoyez-le depuis le WhatsApp du numéro saisi sur ExtravertyAI, ou demandez un nouveau code.",
} as const;

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

async function resolveNumero(db: Db, userId: string, target: VerificationTarget) {
  return "projectId" in target
    ? (await loadProject(db, target.projectId, userId)).numero
    : target.numero;
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
 * Envoi au compte WhatsApp du numéro. Un compte resté à l’ancienne numérotation
 * gabonaise (+241 06…) n’existe pas sous la nouvelle (+241 66…) : on lui écrit
 * alors sous l’ancienne, qui est le même numéro.
 */
async function sendToAccount(send: OtpSender, digits: string, text: string) {
  try {
    await send(digits, text);
  } catch (error) {
    const alternate = alternateWhatsAppDigits(digits);
    if (
      !alternate ||
      !(error instanceof PhoneVerificationError) ||
      error.code !== "NOT_ON_WHATSAPP"
    )
      throw error;
    await send(alternate, text);
  }
}

/**
 * Envoie un nouveau code. Le code envoyé précédemment au compte est annulé,
 * quel que soit son numéro : un seul code reçu valable à la fois.
 */
export async function sendVerificationCode(
  db: Db,
  input: { userId: string; target: VerificationTarget },
  send: OtpSender = sendWhatsAppCode,
  available = whatsAppVerificationAvailable(),
) {
  const digits = digitsOf(await resolveNumero(db, input.userId, input.target));
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
      where: { userId: input.userId, numberHash, direction: "OUTBOUND" },
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
    // Seuls les codes réellement envoyés comptent : écrire en premier à un
    // numéro est ce qui expose le numéro d’ExtravertyAI.
    const sent = { direction: "OUTBOUND" as const };
    const [perHour, perNumber, perDay] = await Promise.all([
      tx.phoneVerification.count({
        where: { ...sent, userId: input.userId, createdAt: { gte: new Date(now - HOUR) } },
      }),
      tx.phoneVerification.count({
        where: { ...sent, numberHash, createdAt: { gte: new Date(now - DAY) } },
      }),
      tx.phoneVerification.count({
        where: { ...sent, userId: input.userId, createdAt: { gte: new Date(now - DAY) } },
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
      where: {
        ...sent,
        userId: input.userId,
        verifiedAt: null,
        expiresAt: { gt: new Date(now) },
      },
      data: { expiresAt: new Date(now) },
    });
    const id = randomUUID();
    return tx.phoneVerification.create({
      data: {
        id,
        userId: input.userId,
        numberHash,
        direction: "OUTBOUND",
        codeHash: hashVerificationCode(id, code),
        expiresAt: new Date(now + CODE_TTL_MS),
      },
      select: { id: true, expiresAt: true, createdAt: true },
    });
  });
  try {
    await sendToAccount(send, digits, verificationMessage(code));
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
  // Un code à envoyer soi-même ne se recopie pas : il ne prouverait rien.
  const latest = await db.phoneVerification.findFirst({
    where: { id: input.verificationId, userId: input.userId, direction: "OUTBOUND" },
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

/**
 * Vérification inversée : prépare un code que le client envoie depuis le
 * WhatsApp du numéro à prouver. Rien ne part de notre numéro.
 */
export async function startInboundVerification(
  db: Db,
  input: { userId: string; target: VerificationTarget },
  available = inboundVerificationAvailable(),
) {
  const digits = digitsOf(await resolveNumero(db, input.userId, input.target));
  const to = otpNumberDigits();
  if (!available || !to)
    throw new PhoneVerificationError(
      "La vérification par message WhatsApp est momentanément indisponible.",
      "UNAVAILABLE",
    );
  const numberHash = hashTrialNumber(digits);
  const code = generateVerificationCode();
  const verification = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "user" WHERE id = ${input.userId} FOR UPDATE`;
    const now = Date.now();
    const recent = await tx.phoneVerification.count({
      where: {
        userId: input.userId,
        direction: "INBOUND",
        createdAt: { gte: new Date(now - HOUR) },
      },
    });
    if (recent >= INBOUND_STARTS_PER_HOUR)
      throw new PhoneVerificationError(
        "Trop de codes demandés. Réessayez dans une heure.",
        "RATE_LIMITED",
        3600,
      );
    // Un seul code à envoyer valable à la fois.
    await tx.phoneVerification.updateMany({
      where: {
        userId: input.userId,
        direction: "INBOUND",
        verifiedAt: null,
        expiresAt: { gt: new Date(now) },
      },
      data: { expiresAt: new Date(now) },
    });
    const id = randomUUID();
    return tx.phoneVerification.create({
      data: {
        id,
        userId: input.userId,
        numberHash,
        direction: "INBOUND",
        codeHash: hashVerificationCode(id, code),
        expiresAt: new Date(now + CODE_TTL_MS),
      },
      select: { id: true, expiresAt: true },
    });
  });
  const text = inboundMessage(code);
  return {
    verificationId: verification.id,
    code,
    text,
    link: `https://wa.me/${to}?text=${encodeURIComponent(text)}`,
    to: formatVerificationNumber(to),
    expiresAt: verification.expiresAt,
  };
}

/** Où en est une vérification de ce compte ? Lue par la page qui attend le message. */
export async function verificationStatus(
  db: Pick<PrismaClient, "phoneVerification">,
  input: { userId: string; verificationId: string },
) {
  const row = await db.phoneVerification.findFirst({
    where: { id: input.verificationId, userId: input.userId },
    select: { verifiedAt: true, expiresAt: true },
  });
  if (row?.verifiedAt) return "verified" as const;
  if (!row || row.expiresAt.getTime() <= Date.now()) return "expired" as const;
  return "pending" as const;
}

const PERSON_SUFFIX = "@s.whatsapp.net";

/** Chiffres du numéro qui a écrit, même quand WhatsApp le cache derrière un @lid. */
export function senderNumberDigits(key: {
  remoteJid: string;
  remoteJidAlt?: string;
  senderPn?: string;
}) {
  for (const jid of [key.remoteJid, key.remoteJidAlt, key.senderPn]) {
    if (!jid?.endsWith(PERSON_SUFFIX)) continue;
    const digits = jid.slice(0, -PERSON_SUFFIX.length).split(":")[0];
    if (/^[1-9]\d{7,14}$/.test(digits)) return digits;
  }
  return null;
}

const InboundMessageSchema = z.object({
  key: z.object({
    remoteJid: z.string().max(250),
    remoteJidAlt: z.string().max(250).optional(),
    senderPn: z.string().max(250).optional(),
    fromMe: z.boolean(),
  }),
  message: z
    .object({
      conversation: z.string().max(4096).optional(),
      extendedTextMessage: z.object({ text: z.string().max(4096).optional() }).optional(),
    })
    .passthrough()
    .nullish(),
});

/**
 * Message reçu sur le numéro d’ExtravertyAI. S’il vient du numéro à prouver et
 * porte son code, ce numéro est prouvé. Renvoie la réponse à faire au client,
 * ou null pour un message sans rapport (rien n’est répondu).
 */
export async function receiveVerificationMessage(
  db: Pick<PrismaClient, "phoneVerification">,
  raw: unknown,
) {
  const parsed = InboundMessageSchema.safeParse(raw);
  if (!parsed.success || parsed.data.key.fromMe) return null;
  const text =
    parsed.data.message?.conversation ??
    parsed.data.message?.extendedTextMessage?.text ??
    "";
  const code = /(?<!\d)(\d{6})(?!\d)/.exec(text)?.[1];
  // L’expéditeur est garanti par WhatsApp : c’est lui qui fait la preuve.
  const digits = senderNumberDigits(parsed.data.key);
  if (!code || !digits) return null;
  const now = new Date();
  const candidates = await db.phoneVerification.findMany({
    where: {
      numberHash: hashTrialNumber(digits),
      direction: "INBOUND",
      verifiedAt: null,
      expiresAt: { gt: now },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { id: true, codeHash: true },
  });
  for (const candidate of candidates) {
    const expected = Buffer.from(candidate.codeHash, "hex");
    const received = Buffer.from(hashVerificationCode(candidate.id, code), "hex");
    if (expected.length !== received.length || !timingSafeEqual(expected, received))
      continue;
    await db.phoneVerification.updateMany({
      where: { id: candidate.id, verifiedAt: null },
      data: { verifiedAt: now },
    });
    return { digits, reply: INBOUND_REPLIES.verified };
  }
  // Six chiffres sans vérification en cours : on n’aide que si le message nous
  // était manifestement destiné.
  return /extravert|code|v[ée]rif/i.test(text)
    ? { digits, reply: INBOUND_REPLIES.unknown }
    : null;
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
