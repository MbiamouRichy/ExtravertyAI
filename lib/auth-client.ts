import { createAuthClient } from "better-auth/react";
import { emailOTPClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  /** The base URL of the server (optional if you're using the same domain) */
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
  plugins: [emailOTPClient()],
});
// Same-origin client: session cookies land on the domain the page is served from.
export const { signIn, signUp, signOut, resetPassword, useSession, emailOtp } =
  createAuthClient({ plugins: [emailOTPClient()] });
