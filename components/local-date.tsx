"use client";
import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { TIME_ZONE_COOKIE } from "@/lib/user-time-zone";

function subscribe(notify: () => void) {
  window.addEventListener("focus", notify);
  document.addEventListener("visibilitychange", notify);
  return () => {
    window.removeEventListener("focus", notify);
    document.removeEventListener("visibilitychange", notify);
  };
}
const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const serverZone = () => "";
export function useUserTimeZone() {
  return useSyncExternalStore(subscribe, browserZone, serverZone);
}

export function TimeZoneSync() {
  const timeZone = useUserTimeZone();
  const router = useRouter();
  useEffect(() => {
    if (!timeZone) return;
    const cookie = `${TIME_ZONE_COOKIE}=${encodeURIComponent(timeZone)}`;
    if (document.cookie.split("; ").includes(cookie)) return;
    document.cookie = `${cookie}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    // Refresh only if cookies are accepted; a blocked cookie must not loop.
    if (document.cookie.split("; ").includes(cookie)) router.refresh();
  }, [timeZone, router]);
  return null;
}

export function LocalDate({
  value,
  options = {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  },
}: {
  value: Date | string | null | undefined;
  options?: Intl.DateTimeFormatOptions;
}) {
  const timeZone = useUserTimeZone();
  if (!value) return <span>—</span>;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return <span>—</span>;
  return (
    <time dateTime={date.toISOString()} title={timeZone || undefined}>
      {timeZone
        ? new Intl.DateTimeFormat("fr-FR", { ...options, timeZone }).format(
            date,
          )
        : "…"}
    </time>
  );
}
