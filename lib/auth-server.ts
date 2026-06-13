import { auth } from "./auth"; // path to your Better Auth server instance
import { headers } from "next/headers";

const getSession = async () => {
  const session = await auth.api.getSession({
    headers: await headers() // Pass the incoming request headers to the auth server
  });
  return session;
} 

export const getUser = async () => {
    const session = await getSession()
    return session?.user;
}