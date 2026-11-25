# Héberger le site de production sur le VPS

Depuis le 25 novembre 2026, le site de production peut tourner sur le VPS Hostinger, à côté des workers et de la base, au lieu de Vercel. Le compte Vercel gratuit avait épuisé son quota mensuel de calcul (4 h de « Fluid Active CPU ») et tout le compte était en pause pour 30 jours.

Ce qui change :

- **le site** est une image Docker (`Dockerfile.web`, service `web` de `compose.web.yaml`) lancée avec `next start` ;
- **le Traefik du VPS** le publie en HTTPS sur `www.extravertyai.com` (certificat Let's Encrypt) et redirige `extravertyai.com` vers `www`, comme Vercel ;
- **le déploiement** : chaque push sur `master`, validé dans GitHub, reconstruit les workers **et** le site (`ops/production/deploy.sh`). Le site n'est remplacé qu'après les workers, et seulement s'il répond (`/api/health`). Sinon, l'image précédente revient d'elle-même.

Ce qui ne change pas : la base, les workers, Polar, Evolution, Google, Resend et Pusher. Le domaine reste le même, donc les webhooks (Polar, Evolution) et les adresses de connexion Google n'ont pas à être modifiés.

La préversion reste sur Vercel. Elle revient quand le compte Vercel sort de sa pause.

Compter environ une heure, plus le temps de propagation du DNS.

---

## 1. Mettre à jour le dossier de production

Dans le terminal du VPS (hPanel du compte VPS → **Terminal**), en root :

```bash
cd /opt/extravertyai-production
git pull --ff-only
install -o root -g root -m 755 ops/production/deploy.sh /usr/local/sbin/extraverty-production-deploy
free -m
```

`free -m` doit montrer au moins 2,5 Go disponibles : la compilation du site en a besoin pendant quelques minutes. Sinon, arrêter les workers de préversion le temps du déploiement (`cd /opt/extravertyai && docker compose stop`).

## 2. Créer `.env.web`

Le site a besoin des mêmes variables que les workers, plus quelques-unes qui n'étaient que sur Vercel.

```bash
cd /opt/extravertyai-production
cp .env.production .env.web
chmod 600 .env.web
nano .env.web
```

Dans `.env.web`, **garder** tel quel tout ce qui vient de `.env.production` (base, Polar, Evolution, Resend, Pusher, OpenRouter, MinIO, `BETTER_AUTH_SECRET`…), puis **ajouter ou corriger** ces lignes. Les valeurs se trouvent sur Vercel : **projet extraverty-ai → Settings → Environment Variables**, environnement **Production**. Le tableau de bord reste consultable pendant la pause.

| Variable | Valeur |
|---|---|
| `NEXT_PUBLIC_APP_URL` | `https://www.extravertyai.com` |
| `BETTER_AUTH_URL` | `https://www.extravertyai.com` |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | celles de Vercel (connexion avec Google) |
| `NEXT_PUBLIC_PUSHER_KEY`, `NEXT_PUBLIC_PUSHER_CLUSTER` | celles de Vercel (temps réel dans le navigateur) |
| `EVOLUTION_WEBHOOK_SECRET` | celle de Vercel, si absente de `.env.production` |
| `POLAR_WEBHOOK_SECRET` | celle de Vercel, si absente de `.env.production` |
| `POLAR_STARTER_CREDIT_PRODUCT_ID`, `POLAR_PRO_CREDIT_PRODUCT_ID`, `POLAR_BUSINESS_CREDIT_PRODUCT_ID` | celles de Vercel (recharges de messages) |
| `INTEGRATIONS_ENCRYPTION_KEY` | **exactement** celle de Vercel |
| `ERROR_TRACKING_DSN`, `NEXT_PUBLIC_ERROR_TRACKING_DSN` | le DSN du projet GlitchTip **`web`** (pas celui des workers) |
| `ERROR_TRACKING_ENVIRONMENT` | `production` |
| `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`, `NEXT_PUBLIC_POSTHOG_HOST` | celles de Vercel (statistiques) |
| `NEXT_PUBLIC_META_PIXEL_ID` | celle de Vercel (pixel Meta) |
| `GOOGLE_SITE_VERIFICATION`, `BING_SITE_VERIFICATION`, `ANALYTICS_SALT`, `ADMIN_EMAILS`, `FEEDBACK_NOTIFY_EMAIL` | celles de Vercel, si elles y sont |

Une variable ne doit apparaître **qu'une fois** : remplacer la ligne existante au lieu d'en ajouter une seconde.

**Une valeur que Vercel refuse d'afficher** (variable « Sensitive ») :
- `GOOGLE_CLIENT_SECRET` : créer un nouveau secret dans Google Cloud Console (**APIs & Services → Credentials** → le client OAuth → **Add secret**). L'ancien reste valable tant qu'on ne le supprime pas.
- `POLAR_WEBHOOK_SECRET` : le lire, ou le régénérer, dans Polar (**Settings → Webhooks** → l'endpoint). Le régénérer coupe les webhooks vers l'ancienne version : le faire juste avant la bascule DNS.
- `BETTER_AUTH_SECRET` et `INTEGRATIONS_ENCRYPTION_KEY` : **ne jamais les régénérer**. Un nouveau `BETTER_AUTH_SECRET` déconnecte tout le monde et permet de reprendre un essai déjà utilisé sur un numéro. Une nouvelle `INTEGRATIONS_ENCRYPTION_KEY` rend illisibles les intégrations enregistrées. Prendre celles de `.env.production` ; elles doivent être identiques à celles de Vercel.

Le script de déploiement vérifie les variables indispensables. Il refuse de continuer en donnant les **noms** de celles qui manquent, jamais leurs valeurs.

## 3. Premier déploiement, à la main

```bash
/usr/local/sbin/extraverty-production-deploy deploy "$(git -C /opt/extravertyai-production ls-remote origin master | cut -f1)"
```

Compter 10 à 15 minutes. Le script :
1. compile les workers et le site ;
2. sauvegarde la base sur R2, applique les migrations et redémarre les workers ;
3. relève sur le serveur le réseau de la base et celui de Traefik, et y relie le site (`/etc/extravertyai/web-networks.compose.yaml`) ;
4. démarre le site et attend qu'il réponde.

La dernière ligne doit être `Site web de production déployé : <commit>`.

Vérifier que le site répond **avant** de toucher au DNS. Le certificat n'existe pas encore, d'où le `-k` :

```bash
curl -sk --resolve www.extravertyai.com:443:127.0.0.1 https://www.extravertyai.com/api/health
curl -sk --resolve www.extravertyai.com:443:127.0.0.1 -o /dev/null -w '%{http_code}\n' https://www.extravertyai.com/
```

Attendu : `{"ok":true}`, puis `200`.

## 4. Faire pointer le domaine vers le VPS

Les serveurs de noms d'`extravertyai.com` sont aujourd'hui **ceux de Vercel** (`ns1.vercel-dns.com`, `ns2.vercel-dns.com`), même si le domaine a été acheté chez Hostinger. La zone DNS se modifie donc chez Vercel, sauf à la déplacer chez Hostinger (option B).

L'adresse du VPS est `187.124.222.189`, celle qu'utilise déjà `errors.extravertyai.com`. La vérifier dans hPanel, compte VPS → **VPS → Aperçu**.

### Option A — rester sur le DNS de Vercel (rapide)

1. Projet **extraverty-ai → Settings → Domains** : retirer `extravertyai.com` et `www.extravertyai.com` du projet. Le domaine et sa zone restent dans le compte.
2. **Domains → extravertyai.com → DNS Records** :
   - supprimer l'enregistrement existant pour `@` et pour `www`, s'il y en a un (`ALIAS`, `A` ou `CNAME` vers Vercel) ;
   - ajouter `A` `@` → `187.124.222.189`, TTL 60 ;
   - ajouter `A` `www` → `187.124.222.189`, TTL 60 ;
   - ne toucher à **aucun** autre enregistrement : mails ImprovMX, Resend (`resend._domainkey`, `send`), vérification Google, `errors`, `db-preview`.
3. Le changement prend effet en quelques minutes.

Si Vercel refuse une de ces actions à cause de la pause, passer à l'option B.

### Option B — déplacer le DNS chez Hostinger (compte DNS)

Le changement de serveurs de noms met jusqu'à 24 h à se propager. Pendant ce temps, certains visiteurs voient encore l'ancienne adresse. Rien ne doit manquer dans la nouvelle zone, sinon les mails du domaine s'arrêtent.

1. Sur Vercel, **Domains → extravertyai.com → DNS Records** : relever **tous** les enregistrements (type, nom, valeur, priorité).
2. Dans hPanel du **compte DNS** → **Domaines → extravertyai.com → DNS / Serveurs de noms**, dans la zone DNS Hostinger, créer :
   - `A` `@` → `187.124.222.189` et `A` `www` → `187.124.222.189` ;
   - `A` `errors` et `A` `db-preview` → `187.124.222.189` ;
   - `MX` `@` → `mx1.improvmx.com` et `mx2.improvmx.com`, avec les **mêmes priorités** que sur Vercel ;
   - `TXT` `@` → `v=spf1 include:spf.improvmx.com ~all` ;
   - `TXT` `@` → la valeur `google-site-verification=…` ;
   - `TXT` `resend._domainkey` → la clé complète (sur Vercel, ou dans Resend → **Domains**) ;
   - `MX` `send` → `feedback-smtp.eu-west-1.amazonses.com` et `TXT` `send` → `v=spf1 include:amazonses.com ~all` ;
   - tout autre enregistrement relevé à l'étape 1.
3. Supprimer les enregistrements par défaut que Hostinger aurait ajoutés pour `@` ou `www`.
4. Choisir **Utiliser les serveurs de noms Hostinger**.

## 5. Vérifier après la bascule

- `https://www.extravertyai.com` s'ouvre, avec un cadenas valide : Traefik obtient le certificat à la première visite, en moins d'une minute.
- `https://extravertyai.com/tarifs` redirige vers `https://www.extravertyai.com/tarifs`.
- Connexion par e-mail et avec Google.
- Polar → **Webhooks → Deliveries** : les nouveaux envois répondent `200`.
- Un message WhatsApp reçu arrive dans la messagerie (webhook Evolution).
- GlitchTip, projet `web` : pas de nouvelle erreur.
- `docker stats --no-stream` : le conteneur `web` reste sous 1 Go.

## Ensuite

- **Déploiements** : rien à faire de plus. Chaque push sur `master`, validé dans GitHub (**Actions → Deploy production workers → Review deployments**), met à jour les workers et le site.
- **Retour arrière** : le script remet tout seul l'image précédente si la nouvelle ne répond pas. Pour revenir à la main sur la version d'avant :

  ```bash
  cd /opt/extravertyai-production
  docker image tag extravertyai-production-web:previous extravertyai-production-web:latest
  COMPOSE_PROJECT_NAME=extravertyai-production \
  COMPOSE_FILE=compose.yaml:compose.override.yaml:compose.web.yaml:/etc/extravertyai/web-networks.compose.yaml \
    docker compose up -d --no-deps --force-recreate web
  ```

- **Revenir sur Vercel**, une fois le compte sorti de sa pause ou passé en Pro : remettre les domaines sur le projet Vercel (ou les enregistrements `A` d'origine), puis arrêter le conteneur `web`. Tant que `.env.web` existe, chaque déploiement relance le site sur le VPS : le renommer pour l'arrêter.
- **Vercel tente encore de déployer** à chaque push et affiche « Account is blocked » : c'est sans effet sur le VPS.
