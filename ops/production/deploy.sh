#!/usr/bin/env bash
# Déploiement de production : workers et, dès que `.env.web` existe, le site
# web (compose.web.yaml, à la place de Vercel). Installé root-owned à
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

# Site web : seulement une fois `.env.web` créé (docs/hebergement-vps.md).
web=false
[[ -f .env.web ]] && web=true

python3 - "$web" <<'PY'
import sys
from pathlib import Path
from urllib.parse import urlsplit

def read(path):
    values = {}
    for line in Path(path).read_text().splitlines():
        if '=' in line and not line.lstrip().startswith('#'):
            name, value = line.split('=', 1)
            values.setdefault(name.strip(), []).append(value.strip().strip('"\''))
    return values

def check(path, label):
    values = read(path)
    database = values.get('DATABASE_URL', [])
    if len(database) != 1:
        raise SystemExit(f'DATABASE_URL doit apparaître une seule fois dans {label}.')
    url = urlsplit(database[0])
    if url.path != '/extravertyai_production' or url.username != 'extraverty_prod':
        raise SystemExit(f'{label} : la production exige la base extravertyai_production et le rôle extraverty_prod.')
    if any(values.get('POLAR_SERVER', [])):
        raise SystemExit(f'{label} : POLAR_SERVER doit être vide en production, sinon les paiements partent vers le sandbox.')
    return values

check('.env.production', '.env.production')
if sys.argv[1] == 'true':
    values = check('.env.web', '.env.web')
    # Noms seulement : aucune valeur n'est jamais affichée.
    required = [
        'BETTER_AUTH_SECRET', 'BETTER_AUTH_URL', 'NEXT_PUBLIC_APP_URL',
        'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'RESEND_API_KEY',
        'EVOLUTION_API_URL', 'EVOLUTION_API_KEY', 'EVOLUTION_WEBHOOK_SECRET',
        'PUSHER_APP_ID', 'PUSHER_KEY', 'PUSHER_SECRET', 'PUSHER_CLUSTER',
        'NEXT_PUBLIC_PUSHER_KEY', 'NEXT_PUBLIC_PUSHER_CLUSTER',
        'POLAR_ACCESS_TOKEN', 'POLAR_WEBHOOK_SECRET',
        'POLAR_STARTER_PRODUCT_ID', 'POLAR_PRO_PRODUCT_ID', 'POLAR_BUSINESS_PRODUCT_ID',
        'OPENROUTER_API_KEY', 'OPENROUTER_MODEL',
        'MINIO_ENDPOINT', 'MINIO_ACCESS_KEY', 'MINIO_SECRET_KEY', 'MINIO_BUCKET',
        'OTP_WHATSAPP_INSTANCE', 'OTP_WHATSAPP_NUMBER', 'INTEGRATIONS_ENCRYPTION_KEY',
    ]
    missing = [name for name in required if not any(values.get(name, []))]
    if missing:
        raise SystemExit('.env.web : variables manquantes ou vides : ' + ', '.join(missing))
    for name in ('NEXT_PUBLIC_APP_URL', 'BETTER_AUTH_URL'):
        if values[name][-1].rstrip('/') != 'https://www.extravertyai.com':
            raise SystemExit(f'.env.web : {name} doit valoir https://www.extravertyai.com.')
PY

compose_files=compose.yaml
[[ -f compose.override.yaml ]] && compose_files+=:compose.override.yaml
if $web; then
  chmod 600 .env.web
  compose_files+=:compose.web.yaml
fi
export COMPOSE_FILE="$compose_files"

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

web_image=extravertyai-production-web
if $web; then
  # L'image en service est gardée : retour immédiat si la nouvelle ne répond pas.
  if docker image inspect "$web_image:latest" > /dev/null 2>&1; then
    docker image tag "$web_image:latest" "$web_image:previous"
  fi
  docker compose build web
fi

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

$web || exit 0

# Réseaux du site, relevés sur le serveur : celui de la base (comme les
# workers) et un seul réseau de Traefik, celui par lequel il joint le site.
networks_file=/etc/extravertyai/web-networks.compose.yaml
list_networks() {
  docker inspect --format '{{range $name, $_ := .NetworkSettings.Networks}}{{println $name}}{{end}}' "$1" \
    | grep -v -x -e '' -e bridge -e host -e none || true
}
# awk lit toute la liste (pas de sortie anticipée : pipefail verrait un SIGPIPE).
traefik="$(docker ps --format '{{.ID}} {{.Image}}' | awk '!found && $2 ~ /(^|\/)traefik([:@]|$)/ { print $1; found = 1 }')"
if [[ -z "$traefik" ]]; then
  echo "Traefik introuvable sur le VPS : site web non publié." >&2
  exit 1
fi
if [[ "$(docker inspect --format '{{.HostConfig.NetworkMode}}' "$traefik")" == host ]]; then
  edge="${COMPOSE_PROJECT_NAME}_default"
  extra_networks=()
else
  edge="$(list_networks "$traefik" | sed -n 1p)"
  extra_networks=("$edge")
fi
if [[ -z "$edge" ]]; then
  echo "Réseau de Traefik introuvable : site web non publié." >&2
  exit 1
fi
mapfile -t networks < <(
  { list_networks "$(docker compose ps -q ai-worker)"; printf '%s\n' "${extra_networks[@]}"; } \
    | grep -v -x -e '' -e "${COMPOSE_PROJECT_NAME}_default" | sort -u
)
for name in "${networks[@]}" "$edge"; do
  [[ "$name" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]*$ ]] || { echo "Nom de réseau inattendu." >&2; exit 1; }
done
install -d -m 700 /etc/extravertyai
{
  echo "# Généré par extraverty-production-deploy : ne pas modifier."
  echo "services:"
  echo "  web:"
  echo "    networks:"
  echo "      - default"
  for i in "${!networks[@]}"; do echo "      - net$i"; done
  echo "    labels:"
  echo "      traefik.docker.network: \"$edge\""
  if ((${#networks[@]})); then
    echo "networks:"
    for i in "${!networks[@]}"; do
      printf '  net%s:\n    external: true\n    name: "%s"\n' "$i" "${networks[$i]}"
    done
  fi
} > "$networks_file"
export COMPOSE_FILE="$COMPOSE_FILE:$networks_file"

wait_web() {
  local id status=""
  id="$(docker compose ps -q web)"
  [[ -n "$id" ]] || return 1
  for _ in $(seq 1 36); do
    status="$(docker inspect --format '{{.State.Health.Status}}' "$id" 2> /dev/null || true)"
    [[ "$status" == healthy ]] && return 0
    sleep 5
  done
  return 1
}

docker compose up -d --no-deps --force-recreate web
if ! wait_web; then
  echo "Le nouveau site ne répond pas : retour à l'image précédente." >&2
  docker compose logs --no-color --tail 40 web >&2 || true
  if docker image inspect "$web_image:previous" > /dev/null 2>&1; then
    docker image tag "$web_image:previous" "$web_image:latest"
    docker compose up -d --no-deps --force-recreate web
    wait_web || echo "L'image précédente ne répond pas non plus." >&2
  else
    docker compose stop web
  fi
  exit 1
fi
echo "Site web de production déployé : $revision"
docker compose ps web
