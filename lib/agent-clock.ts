import { projectTimeZone } from "./time-zones";

/**
 * Date et heure de l'activité, données à l'assistant à chaque réponse. Il ne
 * voit pas quand les messages ont été écrits : sans cette ligne, il propose
 * « aujourd'hui 17 h » à un client qui écrit à 20 h, ou se trompe de « demain ».
 * Fuseau du projet (celui de ses clients), à la minute.
 */
export function agentClockInstruction(timeZone: unknown, now: Date = new Date()): string {
  const zone = projectTimeZone(timeZone);
  const moment = new Intl.DateTimeFormat("fr-FR", {
    timeZone: zone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(now);
  // Nom de ville plutôt que l'identifiant IANA, que l'assistant recopierait.
  const city = zone.split("/").pop()?.replaceAll("_", " ") ?? zone;
  const label = zone.includes("/") ? `heure de ${city}` : `heure ${zone}`;
  return `Date et heure actuelles chez l'entreprise (${label}) : ${moment}. Tiens-en compte pour les créneaux, les horaires, les délais et les mots comme « ce soir » ou « demain » ; ne la cite que si c'est utile.`;
}
