import { EmailTemplate } from "@/components/emailTemplate/emailTemplate";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import prisma from "./prisma";
import { resend } from "./resend";
import { ResetPasswordTemplate } from "@/components/emailTemplate/resetPasswordTemplate";
import { ChangeEmailTemplate } from "@/components/emailTemplate/changeEmailTemplate";
import { DeleteAccountEmailTemplate } from "@/components/emailTemplate/DeleteAccountEmailTemplate";

export const auth = betterAuth({
  baseURL: process.env.NEXT_PUBLIC_BASE_URL as string,
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google", "tiktok"],
    },
  },
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url }) => {
      await resend.emails.send({
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
      await resend.emails.send({
        to: user.email,
        subject: "Verifier votre adresse e-mail",
        html: EmailTemplate({ url, email: user.email }),
        from: "ExtravertyAI <notification@extravertyai.com>",
      });
    },
  },
  user: {
    deleteUser: {
      enabled: true,
      sendDeleteAccountVerification: async ({ user, url }) => {
        await resend.emails.send({
          to: user.email,
          subject: "Approuver la suppression de votre compte",
          html: DeleteAccountEmailTemplate({ url }),
          from: "ExtravertyAI <notification@extravertyai.com>",
        });
      },
    },
    changeEmail: {
      enabled: true,
      sendChangeEmailConfirmation: async ({ user, newEmail, url }) => {
        await resend.emails.send({
          to: user.email, // Sent to the CURRENT email
          subject: "Approuver un changement d'email",
          html: ChangeEmailTemplate({ newEmail, url }),
          from: "ExtravertyAI <notification@extravertyai.com>",
        });
      },
    },
    additionalFields: {
      globalRole: {
        type: "string",
        required: false,
        defaultValue: "USER", // Assurez-vous que ça correspond à votre enum
      },
    },
  },
});
