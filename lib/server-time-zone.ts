import "server-only";
import { cookies } from "next/headers";
import { TIME_ZONE_COOKIE, validTimeZone } from "./user-time-zone";

export async function getUserTimeZone() {
  const value = (await cookies()).get(TIME_ZONE_COOKIE)?.value;
  try {
    return validTimeZone(decodeURIComponent(value ?? "")) ?? "UTC";
  } catch {
    return "UTC";
  }
}
