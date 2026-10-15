export const TIME_ZONE_COOKIE = "extraverty-time-zone";

export function validTimeZone(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 100) return null;
  try {
    return new Intl.DateTimeFormat("en", { timeZone: value }).resolvedOptions()
      .timeZone;
  } catch {
    return null;
  }
}

// Calendar keys are local dates, not instants: never shift them a second time.
const dayFormatters = new Map<string, Intl.DateTimeFormat>();
export function localDayKey(date: Date, timeZone: string): string {
  let formatter = dayFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    // Bound process-wide memory while reusing the formatter for every message.
    if (dayFormatters.size >= 32) dayFormatters.clear();
    dayFormatters.set(timeZone, formatter);
  }
  const parts = formatter.formatToParts(date);
  const value = (type: string) =>
    parts.find((part) => part.type === type)!.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}
