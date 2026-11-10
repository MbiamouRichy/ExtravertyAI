#!/usr/bin/env bash
# Test de restauration : prouve qu’une sauvegarde copiée sur R2 permet de
# reconstruire la base de production. Ne touche jamais la base de production :
# tout se passe dans une base jetable, supprimée à la fin.
#   sudo /usr/local/sbin/extraverty-production-restore-test
#
# Étapes : téléchargement de la dernière sauvegarde R2, contrôle de l’empreinte,
# déchiffrement, restauration complète dans `extravertyai_restore_check`, puis
# comparaison des migrations et du nombre de lignes avec la base en service.
set -Eeuo pipefail

CONTAINER="${PG_CONTAINER:-postgresql-mi4k-postgresql-1}"
LIVE=extravertyai_production
SCRATCH=extravertyai_restore_check
KEY_FILE=/etc/extravertyai/backup.key
ENV_FILE=/etc/extravertyai/backup.env
RCLONE_IMAGE=rclone/rclone:1.71.2

[[ $EUID -eq 0 ]] || { echo "À lancer en root." >&2; exit 1; }
[[ -s "$ENV_FILE" && -s "$KEY_FILE" ]] || { echo "Configuration R2 ou clé absente." >&2; exit 1; }
R2_BUCKET="$(sed -n "s/^R2_BUCKET=//p" "$ENV_FILE" | tail -1)"
[[ -n "$R2_BUCKET" ]] || { echo "R2_BUCKET manquant dans $ENV_FILE" >&2; exit 1; }

work="$(mktemp -d /var/tmp/extraverty-restore.XXXXXX)"
chmod 700 "$work"
psql_admin() {
  docker exec -i "$CONTAINER" sh -c 'exec psql -v ON_ERROR_STOP=1 -X -q -tA -U "$POSTGRES_USER" "$@"' psql "$@"
}
cleanup() {
  psql_admin -d postgres -c "DROP DATABASE IF EXISTS $SCRATCH WITH (FORCE)" > /dev/null || true
  rm -rf "$work"
}
trap cleanup EXIT

rclone() {
  docker run --rm --env-file "$ENV_FILE" -v "$work:/data" "$RCLONE_IMAGE" "$@"
}
latest="$(rclone lsf "r2:$R2_BUCKET/production/" --include '*.dump.enc' | sort | tail -1)"
[[ -n "$latest" ]] || { echo "Aucune sauvegarde sur R2." >&2; exit 1; }
echo "Sauvegarde testée : $latest"
rclone copy "r2:$R2_BUCKET/production/$latest" /data/
rclone copy "r2:$R2_BUCKET/production/$latest.sha256" /data/

[[ "$(sha256sum "$work/$latest" | awk '{print $1}')" == "$(cat "$work/$latest.sha256")" ]] \
  || { echo "Empreinte différente : sauvegarde altérée." >&2; exit 1; }
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass "file:$KEY_FILE" \
  -in "$work/$latest" -out "$work/restore.dump"

psql_admin -d postgres -c "DROP DATABASE IF EXISTS $SCRATCH WITH (FORCE)" > /dev/null
psql_admin -d postgres -c "CREATE DATABASE $SCRATCH TEMPLATE template0" > /dev/null
started=$SECONDS
docker exec -i "$CONTAINER" sh -c 'exec pg_restore -U "$POSTGRES_USER" --no-owner --no-acl --exit-on-error -d "$1"' \
  pg_restore "$SCRATCH" < "$work/restore.dump"
echo "Restauration complète en $((SECONDS - started)) s."

count() { psql_admin -d "$1" -c "$2"; }
MIGRATIONS="SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL"
restored_migrations="$(count "$SCRATCH" "$MIGRATIONS")"
live_migrations="$(count "$LIVE" "$MIGRATIONS")"
echo "Migrations : restaurées $restored_migrations, en service $live_migrations."

status=0
printf '%-22s %12s %12s\n' "Table" "Restaurée" "En service"
for table in '"user"' project project_membership contact message; do
  restored="$(count "$SCRATCH" "SELECT count(*) FROM $table")"
  live="$(count "$LIVE" "SELECT count(*) FROM $table")"
  printf '%-22s %12s %12s\n' "$table" "$restored" "$live"
  # La base en service a pu grandir depuis la sauvegarde, jamais rétrécir autant.
  if (( restored > live )); then status=1; fi
done

if (( restored_migrations == 0 )); then
  echo "ÉCHEC : la base restaurée ne contient aucune migration." >&2
  exit 1
fi
if (( status != 0 )); then
  echo "ÉCHEC : la sauvegarde contient plus de lignes que la base en service." >&2
  exit 1
fi
echo "RÉUSSI : la sauvegarde $latest se restaure entièrement."
