# Mise en service de la production

Ce guide lève les trois points bloquants restants du [rapport de décision](decision-mise-en-production-2026-11-09.md) :

1. le suivi des erreurs (GlitchTip) ;
2. une base de production séparée, sauvegardée hors du VPS, avec une restauration testée ;
3. un vrai paiement Polar vérifié de bout en bout.

Tout se fait sur le VPS Hostinger, sur Vercel, sur Cloudflare et chez Polar. **Aucun secret ne passe par Git, un ticket ou une conversation** : chaque mot de passe est tiré au hasard sur le VPS et copié directement là où il sert.

Suivre les étapes dans l'ordre. Compter une demi-journée, plus 10 jours d'attente pour le premier prélèvement réel (étape 5.4).

---

## 0. Prérequis

- Un accès root au VPS, avec la commande `docker compose` disponible.
- Assez de mémoire. Après cette mise en service, le VPS fera tourner 8 workers (4 en préversion, 4 en production, 384 Mo maximum chacun), GlitchTip (environ 1 Go avec sa base), PostgreSQL et Evolution.

  ```bash
  free -m
  ```

  Il faut au moins 2,5 Go disponibles avant de commencer. Sinon, arrêter les workers de préversion pendant les heures creuses.

- Dans la zone DNS d'`extravertyai.com`, un enregistrement **A** `errors` qui pointe vers l'adresse IP du VPS.
- Un compte Cloudflare avec R2 activé. R2 demande une carte bancaire, mais 10 Go sont gratuits.

## 1. Suivi des erreurs : GlitchTip

### 1.1 Installer GlitchTip sur le VPS

1. Mettre à jour le dépôt de la préversion pour avoir les nouveaux fichiers d'exploitation :

   ```bash
   cd /opt/extravertyai
   git pull --ff-only
   ```

2. Créer le dossier de GlitchTip et ses secrets :

   ```bash
   install -d -m 700 /opt/glitchtip
   cp ops/glitchtip/compose.yaml /opt/glitchtip/
   cp ops/glitchtip/.env.example /opt/glitchtip/.env
   chmod 600 /opt/glitchtip/.env
   ```

3. Dans `/opt/glitchtip/.env` :
   - mettre deux valeurs tirées au hasard dans `GLITCHTIP_DB_PASSWORD` et `GLITCHTIP_SECRET_KEY`. Les générer avec `openssl rand -hex 32` et les coller **directement dans le fichier**, jamais ailleurs ;
   - mettre `GLITCHTIP_OPEN_REGISTRATION=true` le temps de créer le premier compte ;
   - pour recevoir les alertes, remplir `GLITCHTIP_EMAIL_URL` avec la clé SMTP de Resend.

4. Démarrer GlitchTip :

   ```bash
   cd /opt/glitchtip
   docker compose up -d
   ```

   L'interface n'écoute que sur `127.0.0.1:8000`.

5. Le Traefik du VPS publie `errors.extravertyai.com` en HTTPS grâce aux étiquettes du service `glitchtip`, comme il le fait pour Evolution et n8n. Le certificat Let's Encrypt est obtenu au premier accès, une fois que l'enregistrement DNS `errors` pointe vers le VPS.

6. Ouvrir `https://errors.extravertyai.com`, créer votre compte, puis remettre `GLITCHTIP_OPEN_REGISTRATION=false` et relancer :

   ```bash
   docker compose up -d
   ```

7. Créer une organisation `ExtravertyAI` et deux projets :
   - `web`, de type Next.js ;
   - `workers`, de type Node.js.

   Chaque projet affiche un **DSN** (Settings → Client Keys).

### 1.2 Brancher l'app et les workers

| Où | Variable | Valeur |
|---|---|---|
| Vercel (Production et Preview) | `ERROR_TRACKING_DSN` | DSN du projet `web` |
| Vercel (Production et Preview) | `NEXT_PUBLIC_ERROR_TRACKING_DSN` | DSN du projet `web` |
| `.env.production` des workers (préversion et production) | `ERROR_TRACKING_DSN` | DSN du projet `workers` |
| `.env.production` des workers | `ERROR_TRACKING_ENVIRONMENT` | `preview` ou `production` |

Sur Vercel, l'environnement (production ou preview) est détecté tout seul. Le navigateur envoie ses erreurs à `/api/monitoring`, sur le même domaine que l'app : les bloqueurs de publicité ne les arrêtent pas. La route ne relaie que les enveloppes adressées au projet `web`. Redéployer après avoir ajouté les variables, parce que `NEXT_PUBLIC_*` est intégré à la compilation.

Ce qui part chez GlitchTip :
- **dans l'app** : les erreurs serveur non rattrapées (pages, actions, routes), les erreurs du navigateur, et celles des pages `error.tsx` et `global-error.tsx` ;
- **dans les workers** : chaque cycle en échec, au plus une fois toutes les 10 minutes par cycle, avec le nombre d'échecs entre deux envois.

Ce qui ne part jamais : les e-mails, les numéros de téléphone, les secrets dans les URL, les cookies, les corps de requête et les utilisateurs. `lib/error-tracking/scrub.ts` les retire avant tout envoi, et `tests/error-tracking.test.ts` le vérifie.

### 1.3 Vérifier

Depuis le dossier des workers, envoyer une erreur d'essai :

```bash
docker compose run --rm --no-deps ai-worker ./node_modules/.bin/tsx -e 'import("./workers/monitoring").then(async (m) => { m.initWorkerMonitoring("essai"); m.reportWorkerError("[essai] GlitchTip", new Error("Erreur d’essai")); await m.flushWorkerMonitoring(); })'
```

Elle doit apparaître dans le projet `workers` en moins d'une minute.

Pour l'app : dans GlitchTip, ouvrir **Settings → Alerts** et créer une alerte par e-mail sur chaque nouvelle erreur, dans les deux projets.

## 2. Base de production séparée

1. Créer la base et son rôle dédié :

   ```bash
   cd /opt/extravertyai
   sudo bash ops/production/create-database.sh
   ```

   Le script crée la base `extravertyai_production` et son propre rôle `extraverty_prod`. Ce rôle ne peut pas lire la préversion, et inversement. Le mot de passe est tiré au hasard. Les deux adresses de connexion sont écrites dans `/etc/extravertyai/production-database.env`, lisible par root seulement, et ne s'affichent jamais à l'écran.

2. Sur **Vercel → Settings → Environment Variables**, dans l'environnement **Production seulement** :
   - mettre dans `DATABASE_URL` la valeur `VERCEL_DATABASE_URL` du fichier ci-dessus. La copier depuis le terminal du VPS vers Vercel, sans passer par une note ou une conversation ;
   - vérifier que l'environnement **Preview** garde l'adresse `extravertyai_preview`.

3. **La production démarre vide.** Au prochain déploiement de `master`, le build Vercel applique toutes les migrations à la nouvelle base (`scripts/vercel-build.ts`). Il faudra donc recréer votre compte et vos projets de démonstration. Les données de la préversion restent dans la préversion.

## 3. Workers de production

1. Créer un second dossier, sur `master`, avec ses propres réglages :

   ```bash
   git clone https://github.com/<OWNER>/<REPO>.git /opt/extravertyai-production
   cd /opt/extravertyai-production
   git checkout master
   cp /opt/extravertyai/.env.production .env.production
   chmod 600 .env.production
   ```

2. Dans `/opt/extravertyai-production/.env.production`, modifier :

   | Variable | Valeur en production |
   |---|---|
   | `DATABASE_URL` | la valeur `DATABASE_URL` de `/etc/extravertyai/production-database.env` (hôte interne `postgresql`) |
   | `NEXT_PUBLIC_APP_URL` | `https://www.extravertyai.com` |
   | `POLAR_SERVER` | vide |
   | `POLAR_ACCESS_TOKEN`, `POLAR_WEBHOOK_SECRET`, `POLAR_*_PRODUCT_ID` | les valeurs de **production** (étape 5) |
   | `ERROR_TRACKING_DSN`, `ERROR_TRACKING_ENVIRONMENT` | DSN `workers` et `production` |
   | `OTP_WHATSAPP_INSTANCE`, `OTP_WHATSAPP_NUMBER` | voir l'encadré ci-dessous |

   > **Le numéro d'envoi des codes.** Une instance Evolution n'envoie ses événements qu'à une seule adresse de webhook. Si la préversion et la production partagent le numéro qui reçoit les codes de vérification, un seul des deux environnements les verra. Donner le numéro actuel à la production, et utiliser un second numéro pour la préversion, ou n'y tester la vérification que ponctuellement.

3. Copier aussi `compose.override.yaml`, qui fait passer les workers par le réseau Docker interne de PostgreSQL :

   ```bash
   cp /opt/extravertyai/compose.override.yaml /opt/extravertyai-production/
   ```

4. Installer les scripts root-owned :

   ```bash
   install -o root -g root -m 755 ops/production/deploy.sh /usr/local/sbin/extraverty-production-deploy
   install -o root -g root -m 755 ops/production/backup.sh /usr/local/sbin/extraverty-production-backup
   install -o root -g root -m 755 ops/production/restore-test.sh /usr/local/sbin/extraverty-production-restore-test
   ```

   Faire d'abord l'étape 4 (sauvegardes) : le déploiement sauvegarde la base avant chaque migration et s'arrête si la sauvegarde échoue.

5. Premier déploiement, à la main :

   ```bash
   /usr/local/sbin/extraverty-production-deploy deploy "$(git -C /opt/extravertyai-production ls-remote origin master | cut -f1)"
   ```

   Le script refuse de continuer :
   - si la branche n'est pas `master` ;
   - si la base n'est pas `extravertyai_production` avec le rôle `extraverty_prod` ;
   - si `POLAR_SERVER` n'est pas vide.

   Il utilise le projet Compose `extravertyai-production` et ne touche donc jamais aux workers de la préversion.

6. Déploiement automatique à chaque push sur `master` (`.github/workflows/deploy-production.yml`) :
   1. Générer une clé SSH dédiée :

      ```bash
      ssh-keygen -t ed25519 -N '' -f /root/production_deploy -C github-production
      ```

   2. Ajouter dans `/root/.ssh/authorized_keys`, devant la clé publique : `restrict,command="/usr/local/sbin/extraverty-production-deploy" `.
   3. Sur GitHub, ouvrir **Settings → Environments → New environment `production`**. Ajouter vos propres validations (« Required reviewers »), puis les secrets :
      - `PRODUCTION_VPS_HOST` ;
      - `PRODUCTION_VPS_SSH_KEY` (la clé privée générée) ;
      - `PRODUCTION_VPS_KNOWN_HOSTS` (résultat de `ssh-keyscan -t ed25519 <hôte>`, à vérifier).
   4. Supprimer `/root/production_deploy` du VPS une fois la clé enregistrée sur GitHub.

   Tant que ces secrets sont absents, le workflow affiche un avertissement et ne déploie rien.

## 4. Sauvegardes hors du VPS (Cloudflare R2)

1. Dans Cloudflare, ouvrir **R2 → Create bucket** et créer `extravertyai-backups` (emplacement : Europe).
2. Ouvrir **R2 → Manage API tokens → Create API token**, avec la permission « Object Read & Write » sur ce seul bucket. Noter l'Access Key ID, la Secret Access Key et l'endpoint `https://<ID>.r2.cloudflarestorage.com`.
3. Sur le VPS :

   ```bash
   cp /opt/extravertyai-production/ops/production/backup.env.example /etc/extravertyai/backup.env
   chmod 600 /etc/extravertyai/backup.env
   # Renseigner les trois valeurs R2 dans ce fichier, sans guillemets.
   openssl rand -hex 48 > /etc/extravertyai/backup.key
   chmod 600 /etc/extravertyai/backup.key
   ```

4. **Copier la clé `/etc/extravertyai/backup.key` hors du VPS**, dans un gestionnaire de mots de passe. Sans elle, les sauvegardes ne peuvent pas être déchiffrées : si le VPS disparaît, elles disparaissent avec lui.
5. Dans GlitchTip, ouvrir **Uptime Monitors → New → Heartbeat** et régler l'intervalle à 1 jour, avec 2 heures de grâce. Copier l'URL du moniteur dans `BACKUP_HEARTBEAT_URL`. Si aucune sauvegarde ne réussit, GlitchTip vous prévient par e-mail.
6. Lancer une première sauvegarde, puis **un test de restauration**. Le test doit afficher `RÉUSSI` :

   ```bash
   /usr/local/sbin/extraverty-production-backup
   /usr/local/sbin/extraverty-production-restore-test
   ```

   Le test télécharge la dernière sauvegarde depuis R2, contrôle son empreinte et la déchiffre. Il la restaure ensuite dans une base jetable, compare les migrations et le nombre de lignes avec la base en service, puis supprime la base jetable. Il ne touche jamais la production.

7. Planifier les deux tâches : une sauvegarde chaque nuit, et un test de restauration le 1er de chaque mois.

   ```bash
   install -o root -g root -m 644 /opt/extravertyai-production/ops/production/cron /etc/cron.d/extravertyai-production
   ```

**Restaurer pour de vrai**, après une perte de données :

1. Arrêter les workers de production.
2. Mettre Vercel en maintenance, ou revenir à un déploiement précédent.
3. Récupérer la sauvegarde voulue avec le début de `restore-test.sh`.
4. Restaurer dans une nouvelle base, puis faire pointer `DATABASE_URL` dessus.

Ne jamais restaurer par-dessus la base en service.

## 5. Facturation Polar en argent réel

### 5.1 Compte et réglages

1. Dans Polar, en **production**, finaliser la vérification du compte (identité et versements via Stripe Connect Express). Poser la question à Polar par écrit : un particulier au Gabon, sans société, est-il accepté comme vendeur ? Garder la réponse.
2. Appliquer les réglages d'organisation de [Facturation Polar](polar-billing.md) :
   - plusieurs abonnements autorisés ;
   - changement d'offre dans le portail ;
   - proration réglée sur « Prorate & charge now ».
3. Créer les trois produits mensuels en USD, aux prix de `lib/pricing.ts` : 15,99 $, 39,99 $ et 99 $.
4. Créer un jeton d'organisation (**Settings → Access Tokens → Create token**) avec les droits listés dans `polar-billing.md`, plus `webhooks:read` pour le contrôle automatique.
5. Créer le webhook `https://www.extravertyai.com/api/webhooks/polar` :
   - format Raw, avec `www` ;
   - tous les événements `subscription.*` et `order.*`.
6. Renseigner les variables Polar de production sur Vercel (environnement Production) et dans `.env.production` des workers de production, puis redéployer les deux.

### 5.2 Contrôle automatique

Ce contrôle est en lecture seule et n'affiche aucun secret :

```bash
cd /opt/extravertyai-production
docker compose -p extravertyai-production run --rm --no-deps billing-worker \
  ./node_modules/.bin/tsx scripts/check-polar-production.ts
```

Il vérifie :
- qu'il n'y a pas de sandbox ;
- que les jetons et les trois produits existent, chacun mensuel, en USD et au bon prix ;
- que l'adresse publique est correcte ;
- que le webhook est bien configuré (adresse exacte, format, événements). Si le jeton n'a pas le droit `webhooks:read`, ce point est à vérifier à la main.

Tout doit être coché avant de continuer.

### 5.3 Parcours dans l'app (le jour même)

1. Sur `https://www.extravertyai.com`, créer un compte avec une adresse à vous.
2. Créer un projet et choisir Starter.
3. Payer avec **votre propre carte**. L'essai de 10 jours démarre : la carte est enregistrée, mais rien n'est prélevé.
4. Vérifier :
   - **dans Polar** : client et abonnement en essai, webhook livré en 200 (Webhooks → Deliveries) ;
   - **dans l'app** : projet actif, offre Starter, quota de 4 000 messages, e-mail de bienvenue ;
   - **dans GlitchTip** : aucune nouvelle erreur.

### 5.4 Premier prélèvement réel

Ce test prouve que l'argent arrive.

1. **Laisser l'essai aller à son terme**, 10 jours plus tard. Vérifier :
   - la commande `order.paid` de 15,99 $ et la facture dans Polar ;
   - le projet toujours actif dans l'app ;
   - le montant sur le solde Polar.
2. Si vous ne voulez pas attendre 10 jours, faire en plus un achat direct, sans l'app : un lien de paiement créé dans le tableau de bord Polar pour le produit Starter, sans essai. L'app l'ignore, puisqu'il n'est rattaché à aucun projet. En revanche, il prouve que la carte est débitée et que le solde Polar augmente.
3. Demander un premier versement (Payout) vers votre compte. Noter le délai et les frais réels jusqu'à l'arrivée de l'argent au Gabon. C'est la preuve demandée par le critère 3.
4. Rembourser les achats d'essai depuis Polar. Vérifier que `order.refunded` est bien reçu.

## 6. Ordre de bascule et retour arrière

1. Étapes 1 à 4 terminées, restauration testée (`RÉUSSI`).
2. Étape 5.1 et 5.2 cochées.
3. Fusionner `codex/preproduction` dans `master` et pousser. Vercel construit, migre la base de production puis publie. Le workflow déploie les workers de production après une sauvegarde.
4. Étapes 5.3, puis 5.4 dans les 10 jours.

Pour revenir en arrière :
- **sur Vercel** : **Deployments → … → Instant Rollback** vers le déploiement précédent ;
- **pour les workers** : `git revert` du commit fautif sur `master`, puis push. Le workflow redéploie l'état précédent, après une nouvelle sauvegarde. Le script n'accepte que la dernière révision de `master` : il ne peut pas déployer un ancien commit par erreur.

Une migration déjà appliquée ne se défait pas toute seule : il faut restaurer la sauvegarde prise juste avant (étape 4).
