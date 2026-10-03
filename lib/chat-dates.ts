export function createChatDateFormatters(timeZone: string) {
  return {
    timeZone,
    timeFormatter: new Intl.DateTimeFormat("fr-FR", { timeZone, hour: "2-digit", minute: "2-digit" }),
    dateFormatter: new Intl.DateTimeFormat("fr-FR", { timeZone, day: "numeric", month: "long", year: "numeric" }),
    previewDateFormatter: new Intl.DateTimeFormat("fr-FR", { timeZone, day: "2-digit", month: "short" }),
  };
}
