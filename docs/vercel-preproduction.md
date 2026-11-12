# Préproduction sur Vercel

Cette version utilise Vercel pour le site Next.js, les actions serveur et les webhooks. Les trois workers persistants (`workers/ai.ts`, `workers/outbound.ts` et `workers/billing.ts`) tournent sur un serveur Docker séparé et partagent la même base PostgreSQL de test. Le fichier `compose.yaml` démarre les workers, pas PostgreSQL ni Evolution API. Ne pas lancer ces boucles permanentes dans une fonction Vercel : les [fonctions ont une durée limitée](https://vercel.com/docs/functions/limitations).

## 1. Importer le dépôt et choisir la branche

Dans Vercel, importer `MbiamouRichy/ExtravertyAI` dans un projet dédié nommé par exemple `extravertyai-preprod`, sans y rattacher le domaine des clients. Choisir le framework Next.js, la racine du dépôt, Node.js 22.x, l’installation `npm ci` et la compilation `npm run build`. Garder le dossier de sortie par défaut de Next.js.

Le script de compilation génère le client Prisma ignoré par Git, puis compile Next.js avec Webpack. Il ne modifie pas la base.

Pour tester la branche `codex/preproduction`, utiliser le menu de création de déploiement dans **Deployments**, saisir cette branche et vérifier qu’elle utilise l’environnement **Preview**. L’import initial peut sélectionner la branche par défaut du dépôt : vérifier la référence avant de tester. [Création manuelle depuis une branche](https://vercel.com/changelog/manually-create-deployments-by-commit-or-branch-in-the-dashboard).

Garder une URL HTTPS stable pour cette recette : l’alias de branche fourni par Vercel, ou un sous-domaine de test affecté à cette branche. Les connexions, invitations et retours de paiement Polar doivent utiliser cette même URL. Ne pas promouvoir la préversion sur le site des clients.

## 2. Renseigner les variables de test

Dans **Settings → Environment Variables**, utiliser l’environnement **Preview**, de préférence limité à cette branche. Le fichier `.env.example` énumère les noms, sans contenir les clés. Ne pas y copier les secrets pour les envoyer sur GitHub. Toute modification des variables nécessite un nouveau déploiement ; les variables `NEXT_PUBLIC_*` sont intégrées au navigateur à la compilation. [Variables Vercel](https://vercel.com/docs/environment-variables).

| Groupe | Variables à renseigner |
| --- | --- |
| Base | `DATABASE_URL` : base PostgreSQL de préproduction accessible en TLS depuis Vercel et les workers |
| URL | `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_BASE_URL`, `NEXT_PUBLIC_AUTH_BASE_URL` : même origine HTTPS stable, sans slash final |
| Sessions | `BETTER_AUTH_SECRET` : secret aléatoire réservé à cet environnement, stable entre les déploiements |
| E-mails | `RESEND_API_KEY` ; autoriser et vérifier le domaine d’envoi `extravertyai.com`, utilisé par le code |
| Connexion Google | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| Connexion TikTok | `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` si ce parcours est testé ; sinon il reste indisponible |
| Fichiers | `MINIO_ENDPOINT`, `MINIO_BUCKET`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY` : stockage de test compatible S3, accessible en HTTPS ; le module actuel exige les clés dès son chargement |
| WhatsApp | `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_WEBHOOK_SECRET` : service et instance de test dédiés |
| Paiement (Polar) | `POLAR_SERVER=sandbox`, `POLAR_ACCESS_TOKEN` du sandbox, `POLAR_WEBHOOK_SECRET` du nouvel endpoint, et `POLAR_STARTER_PRODUCT_ID`, `POLAR_PRO_PRODUCT_ID`, `POLAR_BUSINESS_PRODUCT_ID` : produits mensuels du sandbox |
| Quotas | `MESSAGE_LIMIT_STARTER=1000`, `MESSAGE_LIMIT_PRO=3000`, `MESSAGE_LIMIT_BUSINESS=10000` |
| Temps réel | `PUSHER_APP_ID`, `PUSHER_KEY`, `PUSHER_SECRET`, `PUSHER_CLUSTER`, `NEXT_PUBLIC_PUSHER_KEY`, `NEXT_PUBLIC_PUSHER_CLUSTER` : application Pusher de test ; les valeurs publiques doivent correspondre aux valeurs serveur |
| IA, sur Vercel **et** sur le serveur des workers | `OPENROUTER_API_KEY`, `OPENROUTER_MODEL=google/gemini-2.5-flash-lite` ; le résumé des conversations est généré par une action serveur du site |

Pour générer un secret de session ou de webhook, exécuter localement `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`, puis le saisir directement dans les paramètres privés du service. Ne jamais utiliser un nom `NEXT_PUBLIC_*` pour une clé privée.

Les adresses `localhost`, `postgres` et `evolution-api` du réseau Docker ne sont pas joignables depuis Vercel. Les remplacer par les points d’accès appropriés. Pour Google, autoriser l’origine de préproduction et le retour `https://VOTRE-HOTE/api/auth/callback/google`. Configurer le retour TikTok `/api/auth/callback/tiktok` si nécessaire. Tester les e-mails avec les destinataires autorisés par le compte Resend.

## 3. Préparer la base, puis déployer

La base de développement déjà confirmée a été migrée. Si elle est réutilisée pour cette recette, vérifier son état avec `npx prisma migrate status` ; ne pas recréer ses données.

Pour une **nouvelle base vide** de préproduction, depuis une copie du dépôt dont `DATABASE_URL` pointe explicitement sur cette base, exécuter :

```sh
npm ci
npm run db:deploy
```

`db:deploy` applique les migrations versionnées. Ne pas utiliser `db push`, `migrate reset` ni rejouer les commandes de référence historique sur une base existante sans comparaison préalable. Les migrations ont été testées ensemble sur une base isolée. [Commande Prisma migrate deploy](https://docs.prisma.io/docs/cli/migrate).

Créer ensuite le déploiement de `codex/preproduction`. Si l’URL stable n’était pas encore disponible lors du premier déploiement, la reporter dans les trois variables d’URL et redéployer avant de créer les comptes de test.

### Migrations appliquées par le build

Dans **Settings → Build and Deployment**, régler la commande de build sur `npm run vercel-build`, pour tous les environnements. Ce script (`scripts/vercel-build.ts`) :

1. compile l’application (`npm run build`) ; un build qui échoue ne touche jamais la base ;
2. puis applique les migrations (`npm run db:deploy`) avec le `DATABASE_URL` de l’environnement du build, **uniquement** pour un build de production et pour la préversion `codex/preproduction` (liste dans `lib/build-migrations.ts`). Les autres branches ne migrent pas : tant que préversion et production partagent une base, une branche d’essai modifierait sinon les données réelles.

Le journal du build indique la décision : « Migrations : application (…) » ou « Migrations ignorées : … ». Si la migration échoue, le déploiement échoue et la version en ligne reste servie. Pour relancer un build sans toucher à la base, définir `SKIP_BUILD_MIGRATIONS=1` dans l’environnement concerné, puis redéployer.

Précautions :

- **Suppressions en deux temps.** La migration s’exécute pendant que l’ancienne version sert encore les visiteurs, et le retour arrière de Vercel ne restaure que le code. Supprimer ou renommer une colonne demande d’abord une version qui ne l’utilise plus, puis la suppression dans une version suivante.
- **Sauvegarde.** Une fois la base de production séparée, la sauvegarder avant chaque mise en production qui contient une migration.
- **Connexion directe.** `prisma migrate deploy` ne passe pas par un pooler en mode transaction (PgBouncer, URL « pooled »). Si `DATABASE_URL` en utilise un, définir aussi `DIRECT_URL` (connexion directe) : `prisma.config.ts` la préfère pour les migrations, l’application garde `DATABASE_URL`.

## 4. Brancher Polar et Evolution

Dans le sandbox Polar, créer un webhook vers `https://VOTRE-HOTE/api/webhooks/polar`, au format `Raw`, avec tous les événements `subscription.*` et `order.*` (détail dans [Facturation Polar](polar-billing.md)).

Recopier son secret dans `POLAR_WEBHOOK_SECRET`, puis redéployer. Autoriser le changement d’offre dans le portail client du sandbox. Payer uniquement avec la carte de test `4242 4242 4242 4242`.

L’application configure les **nouvelles** instances Evolution vers `https://VOTRE-HOTE/api/webhooks/evolution?secret=VOTRE_SECRET_EVOLUTION`. Pour une instance de test déjà créée, mettre à jour son webhook dans Evolution ; aucun changement d’URL Vercel ne met à jour les anciennes instances automatiquement. Activer `CONNECTION_UPDATE`, `MESSAGES_UPSERT`, `MESSAGES_UPDATE`, sans suffixe par événement (`webhookByEvents=false`).

Si la protection Vercel est active, Polar et Evolution doivent pouvoir franchir cette protection. Créer un secret dans **Deployment Protection → Protection Bypass for Automation** et ajouter `x-vercel-protection-bypass=VOTRE_SECRET_VERCEL` aux URL privées de leurs webhooks : `?` pour le premier paramètre, `&` si le paramètre Evolution `secret` est déjà présent. Faire cette configuration manuellement dans Evolution après chaque création d’instance de test : l’application n’ajoute pas ce paramètre automatiquement. Conserver la signature Polar et le secret Evolution ; le bypass Vercel ne les remplace pas. Ne pas publier ces URL complètes dans des tickets ou des captures. [Contournement pour les intégrations autorisées](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation).

## 5. Démarrer les workers sur le serveur de test

Installer Docker avec Compose sur le serveur prévu pour les workers. Cloner le dépôt, sélectionner `codex/preproduction`, puis créer `.env.production` depuis `.env.example` **sur ce serveur seulement**. Malgré le nom de ce fichier, y saisir les valeurs de préproduction. Les workers doivent partager `DATABASE_URL`, les réglages Evolution et Pusher avec Vercel, ainsi que les clés OpenRouter côté serveur.

Une fois l’instance WhatsApp dédiée et le destinataire de test prêts :

```sh
docker compose build
docker compose up -d ai-worker outbound-worker billing-worker
docker compose logs --tail=100 ai-worker outbound-worker billing-worker
```

Ces commandes activent le traitement et les envois des jobs en attente de cette base. Vérifier qu’elle ne contient que les échanges autorisés pour la recette avant le démarrage. Ne pas réutiliser une instance WhatsApp de clients réels. Un arrêt des workers n’efface pas la file : les jobs restent en base.

## 6. Exécuter la recette

Suivre [la grille de recette](recette.md) : pages publiques, compte, création et paiement de test, configuration agent, chat entrant/sortant, reprise humaine, contacts, exports, réglages, facturation et droits d’accès. Vérifier dans les journaux Polar/Evolution que les webhooks reçoivent bien une réponse applicative, pas une page de connexion Vercel. Un site qui s’affiche ne valide pas les échanges IA.

État avant préproduction : 18 tests métiers réussis sur base isolée ; compilation locale réussie. La validation visuelle complète, le contrat de l’instance Evolution déployée et les échanges réels restent à exécuter. L’audit des dépendances conserve six alertes transitives décrites dans [deployment.md](deployment.md). Les commandes Docker ci-dessus n’ont pas été exécutées sur un serveur distant.

## Cible de validation de la facturation

URL de préproduction : https://extraverty-ai-git-codex-preproduction-richy00s-projects.vercel.app

Les workers existants sont hébergés sur le VPS Docker Hostinger KVM2. Ajouter le service `billing-worker` dans cette installation en conservant la base de test et les clés Polar du sandbox. Sur le worker de facturation, définir `NEXT_PUBLIC_APP_URL` avec l’URL HTTPS ci-dessus ; conserver les URL locales du poste de développement. Configurer également Resend et son expéditeur vérifié.

Suivre [le guide de facturation](billing-lifecycle.md) pour la migration et le suivi des notifications. Valider cette préproduction avant toute activation en production.
