#!/usr/bin/env bash
# Sauvegarde quotidienne de la base de production, chiffrée, copiée hors du VPS
# (Cloudflare R2). Installée par docs/production.md, lancée par cron :
#   /usr/local/sbin/extraverty-production-backup
#
# 1. pg_dump (format custom) dans le conteneur PostgreSQL ;
# 2. contrôle que l’archive est lisible (pg_restore --list) ;
# 3. chiffrement AES-256 avec la clé /etc/extravertyai/backup.key ;
# 4. envoi vers R2 par rclone (image Docker, rien à installer sur le VPS) ;
# 5. rétention : 7 jours sur le VPS, 35 jours sur R2 ;
# 6. signal « tout va bien » au moniteur de GlitchTip, s’il est configuré.
# Toute étape en échec arrête le script avec un code non nul, sans signal :
# le moniteur de GlitchTip prévient alors par e-mail.
set -Eeuo pipefail

CONTAINER="${PG_CONTAINER:-postgresql-mi4k-postgresql-1}"
DATABASE=extravertyai_production
LOCAL_DIR=/var/backups/extravertyai-production
KEY_FILE=/etc/extravertyai/backup.key
ENV_FILE=/etc/extravertyai/backup.env
RCLONE_IMAGE=rclone/rclone:1.71.2

[[ $EUID -eq 0 ]] || { echo "À lancer en root." >&2; exit 1; }
[[ -s "$KEY_FILE" ]] || { echo "Clé de chiffrement absente : $KEY_FILE" >&2; exit 1; }
[[ -s "$ENV_FILE" ]] || { echo "Configuration R2 absente : $ENV_FILE" >&2; exit 1; }
R2_BUCKET="$(sed -n "s/^R2_BUCKET=//p" "$ENV_FILE" | tail -1)"
BACKUP_HEARTBEAT_URL="$(sed -n "s/^BACKUP_HEARTBEAT_URL=//p" "$ENV_FILE" | tail -1)"
[[ -n "${R2_BUCKET:-}" ]] || { echo "R2_BUCKET manquant dans $ENV_FILE" >&2; exit 1; }

exec 9>/run/lock/extravertyai-production-backup.lock
flock -n 9 || { echo "Une sauvegarde est déjà en cours." >&2; exit 1; }

install -d -m 700 "$LOCAL_DIR"
umask 077
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
dump="$LOCAL_DIR/$stamp.dump"
encrypted="$dump.enc"
trap 'rm -f "$dump"' EXIT

docker exec "$CONTAINER" sh -c 'exec pg_dump -U "$POSTGRES_USER" -Fc -Z 6 "$1"' pg_dump "$DATABASE" > "$dump"
test -s "$dump"
# Une archive tronquée ou corrompue échoue ici, pas le jour de la restauration.
docker exec -i "$CONTAINER" pg_restore --list < "$dump" > /dev/null

openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass "file:$KEY_FILE" -in "$dump" -out "$encrypted"
sha256sum "$encrypted" | awk '{print $1}' > "$encrypted.sha256"

rclone() {
  docker run --rm --env-file "$ENV_FILE" -v "$LOCAL_DIR:/data" "$RCLONE_IMAGE" "$@"
}
rclone copy "/data/$(basename "$encrypted")" "r2:$R2_BUCKET/production/" --s3-no-check-bucket
rclone copy "/data/$(basename "$encrypted").sha256" "r2:$R2_BUCKET/production/" --s3-no-check-bucket
# Vérifie que la copie distante est bien là, avec la même taille.
rclone check "/data/$(basename "$encrypted")" "r2:$R2_BUCKET/production/" --size-only --one-way \
  --include "$(basename "$encrypted")"

find "$LOCAL_DIR" -name '*.dump.enc*' -mtime +7 -delete
rclone delete "r2:$R2_BUCKET/production/" --min-age 35d

size="$(du -h "$encrypted" | cut -f1)"
echo "Sauvegarde $stamp envoyée sur R2 ($size)."
if [[ -n "${BACKUP_HEARTBEAT_URL:-}" ]]; then
  curl -fsS -m 15 -X POST "$BACKUP_HEARTBEAT_URL" > /dev/null || echo "Signal au moniteur impossible." >&2
fi
