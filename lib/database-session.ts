/**
 * Fuseau de chaque session PostgreSQL ouverte par l’application.
 *
 * `@prisma/adapter-pg` relit un `timestamptz` en remplaçant son décalage par
 * `+00:00`, sans le convertir. Hors UTC, `clock_timestamp()` arriverait donc
 * décalé d’autant, comme les comparaisons et les écritures SQL entre les
 * colonnes `timestamp(3)`, stockées en UTC, et l’horloge de la base.
 */
export const DATABASE_TIME_ZONE = "UTC";

/** Option de démarrage de `pg` : chaque connexion naît dans ce fuseau, quel que soit celui du serveur. */
export const DATABASE_SESSION_OPTIONS = `-c TimeZone=${DATABASE_TIME_ZONE}`;
