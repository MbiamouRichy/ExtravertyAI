import { EmailTemplate } from "@/components/emailTemplate/emailTemplate";
import { betterAuth } from "better-auth";
import {
  APIError,
  createAuthMiddleware,
  getAuthoritativeSessionFromCtx,
} from "better-auth/api";
import { isRecentSession } from "./recent-session";
import { prismaAdapter } from "better-auth/adapters/prisma";
import prisma from "./prisma";
import { resend } from "./resend";
import { ResetPasswordTemplate } from "@/components/emailTemplate/resetPasswordTemplate";
import { ChangeEmailTemplate } from "@/components/emailTemplate/changeEmailTemplate";

import { AccountDeletedEmailTemplate } from "@/components/emailTemplate/accountDeletedEmailTemplate";
import { deleteProjectResources } from "./project-deletion";
import { getAccountDeletionPlan } from "./account-deletion";
import {
  createDeletionFeedbackToken,
  DELETION_FEEDBACK_COOKIE,
  DELETION_FEEDBACK_TTL_SECONDS,
  recordAccountDeletion,
} from "./account-deletion-records";

// Filled by the user delete hook and read by afterDelete in the same request,
// once the user row (and the data used to describe the deletion) is gone.
// Entries of deletions that failed after the hook expire instead of piling up.
const PENDING_DELETION_TTL_MS = 10 * 60 * 1000;
const pendingDeletions = new Map<
  string,
  { projects: string[]; left: number; at: number }
>();
function takePendingDeletion(userId: string) {
  const entry = pendingDeletions.get(userId);
  pendingDeletions.delete(userId);
  return entry && Date.now() - entry.at < PENDING_DELETION_TTL_MS
    ? entry
    : undefined;
}
function setPendingDeletion(userId: string, projects: string[], left: number) {
  const now = Date.now();
  for (const [id, entry] of pendingDeletions)
    if (now - entry.at >= PENDING_DELETION_TTL_MS) pendingDeletions.delete(id);
  pendingDeletions.set(userId, { projects, left, at: now });
}
// Exit-survey token handed from afterDelete to the after hook of the same
// request, which owns the response and can set the cookie.
const feedbackTokens = new WeakMap<Request, string>();

// Resend reports a refused send through `error` instead of rejecting.
async function sendAuthEmail(message: Parameters<typeof resend.emails.send>[0]) {
  const { error } = await resend.emails.send(message);
  if (error) throw new Error(`Resend: ${error.message}`);
}

async function assertNoOwnershipBlockers(userId: string) {
  const plan = await getAccountDeletionPlan(userId);
  if (plan.blockers.length)
    throw new APIError("FORBIDDEN", {
      code: "OWNERSHIP_TRANSFER_REQUIRED",
      message:
        "Transférez la propriété de vos projets partagés avant de supprimer votre compte.",
    });
  return plan;
}

export const auth = betterAuth({
  baseURL: process.env.NEXT_PUBLIC_APP_URL as string,
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === "/delete-user" || ctx.path === "/delete-user/callback") {
        const session = await getAuthoritativeSessionFromCtx(ctx);
        if (!session || !isRecentSession(session.session.createdAt)) {
          throw new APIError("FORBIDDEN", {
            code: "REAUTH_REQUIRED",
            message:
              "Reconnectez-vous avant de supprimer votre compte (connexion de moins de 10 minutes requise).",
          });
        }
        await assertNoOwnershipBlockers(session.session.userId);
      }
    }),
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/delete-user" || !ctx.request) return;
      const token = feedbackTokens.get(ctx.request);
      if (!token) return;
      feedbackTokens.delete(ctx.request);
      // Only readable by the goodbye page's server action, for a single answer.
      ctx.setCookie(DELETION_FEEDBACK_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/goodbye",
        maxAge: DELETION_FEEDBACK_TTL_SECONDS,
      });
    }),
  },

  databaseHooks: {
    user: {
      delete: {
        before: async (user) => {
          // Re-checked here: this hook also runs for deletions that bypass the
          // HTTP routes. Shared projects must be transferred, never deleted
          // for the whole team; co-owned projects only lose this membership.
          const plan = await assertNoOwnershipBlockers(user.id);
          // Abort account deletion on cleanup failure; otherwise a subscription
          // could keep billing after its only management account disappeared.
          for (const project of plan.deleted) {
            await deleteProjectResources(project.id, user.id);
          }
          setPendingDeletion(
            user.id,
            plan.deleted.map((project) => project.name),
            plan.left,
          );
        },
      },
    },
  },

  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google", "tiktok"],
    },
  },
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url }) => {
      await sendAuthEmail({
        to: user.email,
        subject: "Changement de mot de passe",
        html: ResetPasswordTemplate({ url, email: user.email }),
        from: "ExtravertyAI <notification@extravertyai.com>",
      });
    },
  },
  socialProviders: {
    google: {
      prompt: "select_account",
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
    tiktok: {
      clientKey: process.env.TIKTOK_CLIENT_KEY as string,
      clientSecret: process.env.TIKTOK_CLIENT_SECRET as string,
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      // Never rethrown: /send-verification-email is public and would answer
      // differently for an unverified account than for an unknown address.
      try {
        await sendAuthEmail({
          to: user.email,
          subject: "Verifier votre adresse e-mail",
          html: EmailTemplate({ url, email: user.email }),
          from: "ExtravertyAI <notification@extravertyai.com>",
        });
      } catch (error) {
        console.error("VERIFICATION_EMAIL_FAILED", error);
      }
    },
  },
  user: {
    deleteUser: {
      enabled: true,
      afterDelete: async (user, request) => {
        const summary = takePendingDeletion(user.id);
        // The account is already gone: none of the follow-ups below may
        // report the deletion as failed to the user.
        try {
          await recordAccountDeletion({
            email: user.email,
            projectsDeleted: summary?.projects.length ?? 0,
            projectsLeft: summary?.left ?? 0,
          });
        } catch (error) {
          console.error("ACCOUNT_DELETION_RECORD_FAILED", error);
        }
        if (request) {
          try {
            feedbackTokens.set(request, await createDeletionFeedbackToken());
          } catch (error) {
            console.error("DELETION_FEEDBACK_TOKEN_FAILED", error);
          }
        }
        try {
          await sendAuthEmail({
            to: user.email,
            subject: "Votre compte ExtravertyAI a été supprimé",
            html: AccountDeletedEmailTemplate({
              email: user.email,
              deletedAt: new Date(),
              projects: summary?.projects ?? [],
              leftProjects: summary?.left ?? 0,
            }),
            from: "ExtravertyAI <notification@extravertyai.com>",
          });
        } catch (error) {
          console.error("ACCOUNT_DELETED_EMAIL_FAILED", error);
        }
      },
    },
    changeEmail: {
      enabled: true,
      sendChangeEmailConfirmation: async ({ user, newEmail, url }) => {
        await sendAuthEmail({
          to: user.email, // Sent to the CURRENT email
          subject: "Approuver un changement d'email",
          html: ChangeEmailTemplate({ newEmail, url }),
          from: "ExtravertyAI <notification@extravertyai.com>",
        });
      },
    },
    additionalFields: {
      globalRole: {
        input: false,
        type: "string",
        required: false,
        defaultValue: "USER", // Assurez-vous que ça correspond à votre enum
      },
      theme: {
        type: "string",
        required: false,
        defaultValue: "system",
      },
    },
  },
});
