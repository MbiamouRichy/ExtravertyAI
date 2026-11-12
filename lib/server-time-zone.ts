import "server-only";
import { cookies } from "next/headers";
import { TIME_ZONE_COOKIE, validTimeZone } from "./user-time-zone";

/** Zone reported by this browser, or null when the cookie is missing or invalid. */
export async function getBrowserTimeZone() {
  const value = (await cookies()).get(TIME_ZONE_COOKIE)?.value;
  try {
    return validTimeZone(decodeURIComponent(value ?? ""));
  } catch {
    return null;
  }
}

export async function getUserTimeZone() {
  return (await getBrowserTimeZone()) ?? "UTC";
}
