import { auth } from "./auth"; // path to your Better Auth server instance
import { headers } from "next/headers";

export const getSession = async (options?: { fresh?: boolean }) => {
  const session = await auth.api.getSession({
    headers: await headers(),
    ...(options?.fresh && {
      query: { disableCookieCache: true, disableRefresh: true },
    }),
  });
  return session;
};

export const getUser = async () => {
  const session = await getSession();
  return session?.user;
};
