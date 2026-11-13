import { test } from "node:test";
import assert from "node:assert/strict";
import { buildBucketKeys, localDayStart, recentLocalDays } from "../lib/analytics";

test("seven recent days are seven calendar days ending today", () => {
  // Vendredi 13 nov. 2026, 21 h 30 à Libreville (UTC+1).
  const now = new Date("2026-11-13T20:30:00Z");
  const { keys, start, previousStart } = recentLocalDays(7, "Africa/Libreville", now);
  assert.deepEqual(keys, [
    "2026-11-07",
    "2026-11-08",
    "2026-11-09",
    "2026-11-10",
    "2026-11-11",
    "2026-11-12",
    "2026-11-13",
  ]);
  // Minuit local du samedi 7, et du samedi précédent pour la comparaison.
  assert.equal(start.toISOString(), "2026-11-06T23:00:00.000Z");
  assert.equal(previousStart.toISOString(), "2026-10-30T23:00:00.000Z");
  // La série de la page Statistiques n'a plus de 8e jour tronqué.
  assert.equal(buildBucketKeys(start, now, "day", "Africa/Libreville").length, 7);
});

test("local midnight follows daylight saving changes", () => {
  // Paris passe à l'heure d'hiver le 25 oct. 2026.
  assert.equal(localDayStart("2026-10-25", "Europe/Paris").toISOString(), "2026-10-24T22:00:00.000Z");
  assert.equal(localDayStart("2026-10-26", "Europe/Paris").toISOString(), "2026-10-25T23:00:00.000Z");
  assert.equal(localDayStart("2026-11-13", "UTC").toISOString(), "2026-11-13T00:00:00.000Z");
  assert.equal(localDayStart("2026-11-13", "America/St_Johns").toISOString(), "2026-11-13T03:30:00.000Z");
});
