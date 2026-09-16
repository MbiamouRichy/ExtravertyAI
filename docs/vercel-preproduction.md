# Préproduction sur Vercel

Cette version utilise Vercel pour le site Next.js, les actions serveur et les webhooks. Les deux workers persistants (`workers/ai.ts` et `workers/outbound.ts`) tournent sur un serveur Docker séparé et partagent la même base PostgreSQL de test. Le fichier `compose.yaml` démarre les workers, pas PostgreSQL ni Evolution API. Ne pas lancer ces boucles permanentes dans une fonction Vercel : les [fonctions ont une durée limitée](https://vercel.com/docs/functions/limitations).

## 1. Importer le dépôt et choisir la branche

Dans Vercel, importer `MbiamouRichy/ExtravertyAI` dans un projet dédié nommé par exemple `extravertyai-preprod`, sans y rattacher le domaine des clients. Choisir le framework Next.js, la racine du dépôt, Node.js 22.x, l’installation `npm ci` et la compilation `npm run build`. Garder le dossier de sortie par défaut de Next.js.

Le script de compilation génère le client Prisma ignoré par Git, puis compile Next.js avec Webpack. Il ne modifie pas la base.

Pour tester la branche `codex/preproduction`, utiliser le menu de création de déploiement dans **Deployments**, saisir cette branche et vérifier qu’elle utilise l’environnement **Preview**. L’import initial peut sélectionner la branche par défaut du dépôt : vérifier la référence avant de tester. [Création manuelle depuis une branche](https://vercel.com/changelog/manually-create-deployments-by-commit-or-branch-in-the-dashboard).

Garder une URL HTTPS stable pour cette recette : l’alias de branche fourni par Vercel, ou un sous-domaine de test affecté à cette branche. Les connexions, invitations et retours Stripe doivent utiliser cette même URL. Ne pas promouvoir la préversion sur le site des clients.

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
| Stripe | `STRIPE_SECRET_KEY` de test, `STRIPE_WEBHOOK_SECRET` du nouvel endpoint, et `STRIPE_STARTER_PLAN_ID`, `STRIPE_PRO_PLAN_ID`, `STRIPE_BUSINESS_PLAN_ID` : identifiants `price_...` des tarifs récurrents de test |
| Quotas | `MESSAGE_LIMIT_STARTER=1000`, `MESSAGE_LIMIT_PRO=3000`, `MESSAGE_LIMIT_BUSINESS=10000` |
| Temps réel | `PUSHER_APP_ID`, `PUSHER_KEY`, `PUSHER_SECRET`, `PUSHER_CLUSTER`, `NEXT_PUBLIC_PUSHER_KEY`, `NEXT_PUBLIC_PUSHER_CLUSTER` : application Pusher de test ; les valeurs publiques doivent correspondre aux valeurs serveur |
| IA, sur le serveur des workers | `OPENROUTER_API_KEY`, `OPENROUTER_MODEL=google/gemini-2.5-flash-lite` |

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

## 4. Brancher Stripe et Evolution

Dans Stripe en mode test, créer un endpoint vers `https://VOTRE-HOTE/api/webhooks/stripe`, avec les événements :

- `checkout.session.completed`
- `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
- `invoice.paid`, `invoice.payment_succeeded`, `invoice.payment_failed`

Recopier son secret de signature dans `STRIPE_WEBHOOK_SECRET`, puis redéployer. Activer le portail client Stripe de test pour les actions de facturation. Utiliser uniquement un moyen de paiement de test fourni par Stripe.

L’application configure les **nouvelles** instances Evolution vers `https://VOTRE-HOTE/api/webhooks/evolution?secret=VOTRE_SECRET_EVOLUTION`. Pour une instance de test déjà créée, mettre à jour son webhook dans Evolution ; aucun changement d’URL Vercel ne met à jour les anciennes instances automatiquement. Activer `CONNECTION_UPDATE`, `MESSAGES_UPSERT`, `MESSAGES_UPDATE`, sans suffixe par événement (`webhookByEvents=false`).

Si la protection Vercel est active, Stripe et Evolution doivent pouvoir franchir cette protection. Créer un secret dans **Deployment Protection → Protection Bypass for Automation** et ajouter `x-vercel-protection-bypass=VOTRE_SECRET_VERCEL` aux URL privées de leurs webhooks : `?` pour le premier paramètre, `&` si le paramètre Evolution `secret` est déjà présent. Faire cette configuration manuellement dans Evolution après chaque création d’instance de test : l’application n’ajoute pas ce paramètre automatiquement. Conserver la signature Stripe et le secret Evolution ; le bypass Vercel ne les remplace pas. Ne pas publier ces URL complètes dans des tickets ou des captures. [Contournement pour les intégrations autorisées](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation).

## 5. Démarrer les workers sur le serveur de test

Installer Docker avec Compose sur le serveur prévu pour les workers. Cloner le dépôt, sélectionner `codex/preproduction`, puis créer `.env.production` depuis `.env.example` **sur ce serveur seulement**. Malgré le nom de ce fichier, y saisir les valeurs de préproduction. Les workers doivent partager `DATABASE_URL`, les réglages Evolution et Pusher avec Vercel, ainsi que les clés OpenRouter côté serveur.

Une fois l’instance WhatsApp dédiée et le destinataire de test prêts :

```sh
docker compose build
docker compose up -d ai-worker outbound-worker
docker compose logs --tail=100 ai-worker outbound-worker
```

Ces commandes activent le traitement et les envois des jobs en attente de cette base. Vérifier qu’elle ne contient que les échanges autorisés pour la recette avant le démarrage. Ne pas réutiliser une instance WhatsApp de clients réels. Un arrêt des workers n’efface pas la file : les jobs restent en base.

## 6. Exécuter la recette

Suivre [la grille de recette](recette.md) : pages publiques, compte, création et paiement de test, configuration agent, chat entrant/sortant, reprise humaine, contacts, exports, réglages, facturation et droits d’accès. Vérifier dans les journaux Stripe/Evolution que les webhooks reçoivent bien une réponse applicative, pas une page de connexion Vercel. Un site qui s’affiche ne valide pas les échanges IA.

État avant préproduction : 18 tests métiers réussis sur base isolée ; compilation locale réussie. La validation visuelle complète, le contrat de l’instance Evolution déployée et les échanges réels restent à exécuter. L’audit des dépendances conserve six alertes transitives décrites dans [deployment.md](deployment.md). Les commandes Docker ci-dessus n’ont pas été exécutées sur un serveur distant.
