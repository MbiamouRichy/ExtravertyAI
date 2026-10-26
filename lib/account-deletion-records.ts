import { createHash, createHmac, randomBytes } from "node:crypto";
import prisma from "./prisma";

export const DELETION_FEEDBACK_COOKIE = "deletion_feedback";
export const DELETION_FEEDBACK_TTL_SECONDS = 24 * 60 * 60;

function secret() {
  const value = process.env.BETTER_AUTH_SECRET;
  if (!value) throw new Error("BETTER_AUTH_SECRET_MISSING");
  return value;
}

/** Keyed hash: proves a given address was erased without storing it. */
export function hashDeletedEmail(email: string) {
  return createHmac("sha256", secret())
    .update(`account-deletion:${email.trim().toLowerCase()}`)
    .digest("hex");
}

export function hashFeedbackToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function recordAccountDeletion(input: {
  email: string;
  projectsDeleted: number;
  projectsLeft: number;
}) {
  await prisma.accountDeletionRecord.create({
    data: {
      emailHash: hashDeletedEmail(input.email),
      projectsDeleted: input.projectsDeleted,
      projectsLeft: input.projectsLeft,
    },
  });
}

/** One-time token allowing a single anonymous answer to the exit survey. */
export async function createDeletionFeedbackToken() {
  const now = Date.now();
  // Unanswered, expired slots carry no information: purge them as we go.
  await prisma.accountDeletionFeedback.deleteMany({
    where: { submittedAt: null, expiresAt: { lt: new Date(now) } },
  });
  const token = randomBytes(32).toString("base64url");
  const hour = 3_600_000;
  await prisma.accountDeletionFeedback.create({
    data: {
      tokenHash: hashFeedbackToken(token),
      // Rounded up to the hour so the slot cannot be matched to a deletion
      // record by its timestamp.
      expiresAt: new Date(
        Math.ceil((now + DELETION_FEEDBACK_TTL_SECONDS * 1000) / hour) * hour,
      ),
    },
  });
  return token;
}
