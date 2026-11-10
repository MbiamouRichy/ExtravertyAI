import { createAuthClient } from "better-auth/react";
import { emailOTPClient } from "better-auth/client/plugins";

import { clearChatDrafts } from "./chat-drafts";

// Déconnexion réussie, quel que soit le bouton : les brouillons de la
// messagerie gardés sur l’appareil sont effacés.
const fetchOptions = {
  onSuccess(context: { request: { url: string | URL } }) {
    if (String(context.request.url).includes("/sign-out")) void clearChatDrafts();
  },
};

export const authClient = createAuthClient({
  /** The base URL of the server (optional if you're using the same domain) */
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
  plugins: [emailOTPClient()],
  fetchOptions,
});
// Same-origin client: session cookies land on the domain the page is served from.
export const { signIn, signUp, signOut, resetPassword, useSession, emailOtp } =
  createAuthClient({ plugins: [emailOTPClient()], fetchOptions });
