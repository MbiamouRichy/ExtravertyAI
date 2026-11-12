#!/usr/bin/env bash
# Crée la base de production séparée et son rôle dédié, dans le conteneur
# PostgreSQL existant du VPS. À lancer une seule fois, en root, sur le VPS :
#   sudo bash ops/production/create-database.sh
#
# Le mot de passe est tiré au hasard et écrit dans un fichier lisible par root
# seul ; il n’apparaît ni à l’écran, ni dans l’historique, ni dans les journaux.
set -Eeuo pipefail

CONTAINER="${PG_CONTAINER:-postgresql-mi4k-postgresql-1}"
DATABASE=extravertyai_production
ROLE=extraverty_prod
SECRET_FILE=/etc/extravertyai/production-database.env

[[ $EUID -eq 0 ]] || { echo "À lancer en root." >&2; exit 1; }
docker inspect "$CONTAINER" >/dev/null

psql_admin() {
  docker exec -i "$CONTAINER" sh -c 'exec psql -v ON_ERROR_STOP=1 -X -q -U "$POSTGRES_USER" -d postgres "$@"' psql "$@"
}

if [[ "$(psql_admin -tAc "SELECT 1 FROM pg_database WHERE datname = '$DATABASE'")" == 1 ]]; then
  echo "La base $DATABASE existe déjà : rien n’est modifié." >&2
  exit 1
fi

install -d -m 700 /etc/extravertyai
umask 077
password="$(openssl rand -hex 32)"

# Le mot de passe passe par l’entrée standard, jamais par la ligne de commande.
psql_admin <<SQL
CREATE ROLE $ROLE LOGIN PASSWORD '$password' CONNECTION LIMIT 40;
CREATE DATABASE $DATABASE OWNER $ROLE ENCODING 'UTF8' TEMPLATE template0;
REVOKE ALL ON DATABASE $DATABASE FROM PUBLIC;
GRANT CONNECT, TEMPORARY ON DATABASE $DATABASE TO $ROLE;
SQL
# La préversion ne doit jamais pouvoir lire la production, ni l’inverse.
psql_admin -d "$DATABASE" <<SQL
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT ALL ON SCHEMA public TO $ROLE;
ALTER SCHEMA public OWNER TO $ROLE;
SQL

cat > "$SECRET_FILE" <<EOF
# Base de production. Fichier root seul (600). Ne jamais le copier dans Git,
# un ticket ou une conversation.
# Workers (réseau Docker interne) : .env.production de /opt/extravertyai-production
DATABASE_URL=postgresql://$ROLE:$password@postgresql:5432/$DATABASE
# Vercel, environnement Production uniquement (port public fixe, TLS exigé) :
VERCEL_DATABASE_URL=postgresql://$ROLE:$password@db-preview.extravertyai.com:32768/$DATABASE?sslmode=require
EOF
chmod 600 "$SECRET_FILE"
unset password

echo "Base $DATABASE et rôle $ROLE créés."
echo "Adresses de connexion écrites dans $SECRET_FILE (lisible par root seulement)."
echo "Suite : docs/production.md, étape « Brancher la production »."
