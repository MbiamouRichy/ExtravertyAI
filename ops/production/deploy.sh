#!/usr/bin/env bash
# Déploiement des workers de production. Installé root-owned à
# /usr/local/sbin/extraverty-production-deploy ; la clé SSH dédiée du workflow
# `deploy-production.yml` n’autorise que cette commande, jamais un shell.
#
# Même procédure que la préversion (scripts/deploy-preview.sh), avec trois
# verrous en plus : branche master, base extravertyai_production et projet
# Compose distinct, pour ne jamais remplacer les workers de la préversion.
set -Eeuo pipefail

read -r action revision extra <<< "${SSH_ORIGINAL_COMMAND:-${*:-}}"
if [[ "$action" != deploy || ! "$revision" =~ ^[0-9a-f]{40}$ || -n "${extra:-}" ]]; then
  echo "Attendu : deploy <SHA de 40 caractères>" >&2
  exit 2
fi
exec 9>/run/lock/extravertyai-production-deploy.lock
flock -w 900 9
cd /opt/extravertyai-production
export GIT_PAGER=cat WORKER_ENV_FILE=.env.production COMPOSE_PROJECT_NAME=extravertyai-production
[[ "$(git branch --show-current)" == master ]]
git diff --quiet
git diff --cached --quiet
git fetch origin master
if [[ "$(git rev-parse FETCH_HEAD)" != "$revision" ]]; then
  echo "Révision dépassée : ignorée."
  exit 0
fi

python3 - <<'PY'
from pathlib import Path
from urllib.parse import urlsplit
lines = Path('.env.production').read_text().splitlines()
def values(name):
    return [line.split('=', 1)[1].strip().strip('"\'') for line in lines if line.startswith(name + '=')]
database = values('DATABASE_URL')
if len(database) != 1:
    raise SystemExit('DATABASE_URL doit apparaître une seule fois dans .env.production.')
url = urlsplit(database[0])
if url.path != '/extravertyai_production' or url.username != 'extraverty_prod':
    raise SystemExit('Le déploiement de production exige la base extravertyai_production et le rôle extraverty_prod.')
if any(values('POLAR_SERVER')):
    raise SystemExit('POLAR_SERVER doit être vide en production : sinon les paiements partent vers le sandbox.')
PY

git merge --ff-only "$revision"
export GIT_COMMIT_SHA="$revision"
docker compose config --quiet
services=(ai-worker outbound-worker billing-worker reports-worker)
# Construire et vérifier TypeScript avant d’arrêter les workers en service.
docker compose build "${services[@]}"
image="$(docker image inspect extravertyai-production-ai-worker --format '{{.Id}}')"
[[ -n "$image" ]]
docker run --rm --network none --memory 3g --cpus 2 \
  -e NODE_OPTIONS=--max-old-space-size=2560 \
  "$image" ./node_modules/.bin/tsc --noEmit --incremental false

# Sauvegarde complète, copiée sur R2, avant toute migration.
/usr/local/sbin/extraverty-production-backup

docker compose stop "${services[@]}"
if ! docker compose run --rm --no-deps ai-worker ./node_modules/.bin/prisma migrate deploy; then
  echo "Migration en échec : redémarrage des workers précédents. Dernière sauvegarde sur R2." >&2
  docker compose start "${services[@]}"
  exit 1
fi
docker compose up -d --no-deps "${services[@]}"
sleep 15
for service in "${services[@]}"; do
  id="$(docker compose ps -q "$service")"
  [[ -n "$id" ]]
  [[ "$(docker inspect --format '{{.State.Running}}' "$id")" == true ]]
  [[ "$(docker inspect --format '{{.RestartCount}}' "$id")" == 0 ]]
done
echo "Workers de production déployés : $revision"
docker compose ps "${services[@]}"
