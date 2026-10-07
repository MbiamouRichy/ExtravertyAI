#!/usr/bin/env bash
set -Eeuo pipefail

# Install root-owned at /usr/local/sbin/extraverty-preview-deploy.
# The dedicated SSH key only permits this command, never an interactive shell.
read -r action revision extra <<< "${SSH_ORIGINAL_COMMAND:-${*:-}}"
if [[ "$action" != deploy || ! "$revision" =~ ^[0-9a-f]{40}$ || -n "${extra:-}" ]]; then
  echo "Expected: deploy <40-character commit SHA>" >&2
  exit 2
fi
exec 9>/run/lock/extravertyai-preview-deploy.lock
flock -w 900 9
cd /opt/extravertyai
export GIT_PAGER=cat WORKER_ENV_FILE=.env.production
[[ "$(git branch --show-current)" == codex/preproduction ]]
git diff --quiet
git diff --cached --quiet
git fetch origin codex/preproduction
if [[ "$(git rev-parse FETCH_HEAD)" != "$revision" ]]; then
  echo "Skipping superseded preview revision."
  exit 0
fi

python3 - <<'PY'
from pathlib import Path
from urllib.parse import urlsplit
values = [line.split('=', 1)[1].strip().strip('\"\'') for line in Path('.env.production').read_text().splitlines() if line.startswith('DATABASE_URL=')]
if len(values) != 1 or urlsplit(values[0]).path != '/extravertyai_preview':
    raise SystemExit('Deployment requires the extravertyai_preview database.')
PY

git merge --ff-only "$revision"
docker compose config --quiet
# Build and typecheck before stopping the running workers.
docker compose build ai-worker outbound-worker billing-worker
image="$(docker image inspect extravertyai-ai-worker --format '{{.Id}}')"
[[ -n "$image" ]]
docker run --rm --network none --memory 1536m --cpus 1 "$image" ./node_modules/.bin/tsc --noEmit --incremental false
install -d -m 700 /var/backups/extravertyai-preview
backup="/var/backups/extravertyai-preview/$(date -u +%Y%m%dT%H%M%SZ)-${revision:0:12}.dump"
umask 077
docker exec postgresql-mi4k-postgresql-1 sh -c 'exec pg_dump -U "$POSTGRES_USER" -Fc extravertyai_preview' > "$backup"
test -s "$backup"

services=(ai-worker outbound-worker billing-worker)
docker compose stop "${services[@]}"
if ! docker compose run --rm --no-deps ai-worker ./node_modules/.bin/prisma migrate deploy; then
  echo "Migration failed; restarting the previous containers. Backup: $backup" >&2
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
echo "Preview workers deployed: $revision"
docker compose ps "${services[@]}"
