import { utcOffsetLabel, validTimeZone } from "./user-time-zone";

/** Zone of projects created before the setting existed, and fallback for an unknown value. */
export const DEFAULT_PROJECT_TIME_ZONE = "Africa/Libreville";

/** A stored zone that is valid on this runtime, or the default one. */
export function projectTimeZone(value: unknown): string {
  return validTimeZone(value) ?? DEFAULT_PROJECT_TIME_ZONE;
}

export type TimeZoneOption = { value: string; label: string; offset: string };
export type TimeZoneGroup = { label: string; options: TimeZoneOption[] };

const REGIONS: Record<string, string> = {
  Africa: "Afrique",
  America: "Amériques",
  Atlantic: "Atlantique",
  Europe: "Europe",
  Asia: "Asie",
  Indian: "Océan Indien",
  Australia: "Australie",
  Pacific: "Pacifique",
  Antarctica: "Antarctique",
  Arctic: "Arctique",
};

const zoneLabel = (zone: string) => zone.split("/").slice(1).join(" / ").replaceAll("_", " ");

/**
 * Every IANA zone of the runtime, grouped by region, with its offset at `date`.
 * Built on the server so the client renders exactly the same list.
 */
export function timeZoneGroups(date = new Date(), include?: string): TimeZoneGroup[] {
  const zones = new Set(Intl.supportedValuesOf("timeZone"));
  // A stored zone missing from this runtime's list stays selectable.
  if (include) zones.add(include);
  const groups = new Map<string, TimeZoneOption[]>(Object.values(REGIONS).map((label) => [label, []]));
  const universal: TimeZoneOption[] = [{ value: "UTC", label: "UTC", offset: "UTC+0" }];
  for (const zone of zones) {
    const region = REGIONS[zone.split("/")[0]];
    if (!region || !zone.includes("/")) {
      if (zone !== "UTC" && validTimeZone(zone)) {
        universal.push({ value: zone, label: zone.replaceAll("_", " "), offset: utcOffsetLabel(zone, date) });
      }
      continue;
    }
    groups.get(region)!.push({ value: zone, label: zoneLabel(zone), offset: utcOffsetLabel(zone, date) });
  }
  const byLabel = (a: TimeZoneOption, b: TimeZoneOption) => a.label.localeCompare(b.label, "fr");
  return [
    ...[...groups]
      .filter(([, options]) => options.length)
      .map(([label, options]) => ({ label, options: options.sort(byLabel) })),
    { label: "Temps universel", options: universal.sort(byLabel) },
  ];
}
