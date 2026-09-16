# Déploiement de la messagerie durable

## Ce qui est livré

Evolution → webhook (transaction PostgreSQL : contact, message, AiJob) → worker IA (OpenRouter) → transaction quota + Message BOT + OutboundJob → worker outbound → Evolution.

Le webhook répond 503 si l'écriture échoue, 400 pour un format invalide. Vérifier/configurer les reprises du fournisseur : un code 503 ne garantit pas à lui seul qu'Evolution rejouera l'événement. Les médias sont visibles dans la conversation ; seules les parties textuelles et légendes alimentent l'IA. La transcription audio, les réponses vocales et une base de connaissances par entreprise ne sont pas implémentées.

Les générations ont trois tentatives au maximum et un bail de 90 secondes avec jeton d'exclusion des anciens traitements. Le délai OpenRouter est de 30 secondes. Le traitement d'une conversation attend son envoi précédent. Une reprise humaine invalide la génération et les BOT encore en attente. La transition DISPATCHING marque le début de l'envoi : une prise en main après ce point ne peut rappeler un message déjà parti.

Les messages sortants incertains ne sont **jamais** renvoyés automatiquement. L'ID fournisseur permet de rapprocher les échos et accusés précoces. Sans ID confirmé, un écho ambigu est conservé pour investigation, sans rapprochement au seul contenu. Les échos manuels sans envoi concurrent sont intégrés après deux minutes et désactivent l'IA ; pendant cette attente, la génération est suspendue. Les notifications Pusher sont complétées par le polling existant.

## Variables

Utiliser `.env.example` pour les variables du parcours de messagerie ; conserver également les variables existantes d'authentification, stockage, e-mail et Stripe de l'application. Le nom exact du modèle est `OPENROUTER_MODEL`. Les identifiants de prix Stripe doivent correspondre aux trois offres. Les plafonds proposés sont 1 000 / 3 000 / 10 000 messages sortants pour Starter / Pro / Business, essai de 150. Un plafond payé absent ou invalide bloque la création de période au lieu d'accorder un quota arbitraire.

Une unité est réservée à l'admission d'un Message + OutboundJob. Une génération échouée ne consomme pas le quota d'envoi (elle peut cependant entraîner un coût fournisseur IA). Les réservations des jobs ensuite annulés/incertains ne sont pas remboursées automatiquement. Les changements de plafonds s'appliquent aux nouvelles périodes, pas rétroactivement.

Les instructions sont maintenant propres à chaque projet : nom de l’agent, message système, ton, longueur, langue et comportements. Après création, `/projects/[projectId]/setup` impose la validation avant accès au chat et avant génération. Les anciens projets doivent également valider leur agent. Une modification incrémente la version de configuration et invalide les générations et BOT encore en attente. Aucun ancien message reçu avant validation n’est rejoué automatiquement.

## Migrations : vérifier le point de départ

L'historique présent avant ce changement ne contenait que les tables d'authentification et l'ancien `Project` avec `userId`. Le schéma Prisma contenait déjà des tables CRM absentes des migrations.

- Base reconstruite depuis les migrations historiques : `202609140001_application_schema` crée le CRM et conserve les anciens projets et leurs propriétaires. L'ancienne table est conservée sous `legacy_project_archive`. Aucun quota historique n'est inventé.
- Base déjà modifiée avec `db push` ou du SQL manuel : **ne pas exécuter aveuglément cette migration**. Comparer la base au schéma précédant ce changement (`git show <commit-précédent>:prisma/schema.prisma`), sauvegarder, corriger les écarts et marquer `202609140001_application_schema` appliquée avec `prisma migrate resolve --applied ...` uniquement lorsque tous ses objets applicatifs existent. Une base partiellement migrée nécessite une migration de réconciliation adaptée à ses écarts.
- `202609140003_agent_settings` ajoute les réglages d’agent, la pause indépendante de la facturation, la synchronisation WhatsApp et le journal de modifications. Les valeurs par défaut ne valident pas automatiquement l’agent.
- `202609140002_durable_ai` ajoute les générations durables, les reçus et les invariants de quota. Elle remplace l'unicité globale des IDs de messages par une unicité par projet.

Ne pas modifier les deux migrations historiques. Ne pas utiliser `migrate dev` ou `db push` en production. Les migrations livrées sont testées sur une base PostgreSQL WASM vierge ; tester également une copie anonymisée de votre base avant bascule.

## Reprise des quotas existants

Arrêter tous les anciens producteurs et les workers pendant cette étape. Relever dans Stripe les bornes exactes du cycle courant et vérifier `project.messageCount` contre l'historique. Créer un manifeste JSON, par exemple :

```json
[
  {
    "projectId": "ID_REEL",
    "key": "cycle:sub_REEL:DEBUT_UNIX_SECONDES",
    "kind": "active",
    "startsAt": "2026-09-01T00:00:00Z",
    "endsAt": "2026-10-01T00:00:00Z",
    "limit": 1000,
    "expectedUsed": 123
  }
]
```

Pour l'essai utiliser `trial:sub_REEL`, les dates réelles d'essai et 150. Les dates ci-dessus sont des exemples, pas des dates de reprise par défaut. Le script refuse les compteurs modifiés, périodes divergentes ou expirées. Il conserve la consommation, y compris si elle dépasse déjà le plafond.

```sh
npx tsx scripts/bootstrap-quotas.ts manifest.json
npx tsx scripts/bootstrap-quotas.ts manifest.json --apply
```

## Conteneurs

`compose.yaml` lance les deux workers uniquement. Il ne remplace pas votre déploiement Next.js. Le nom du Dockerfile respecte la casse Linux. L'image inclut Prisma CLI pour exécuter les migrations. Aucun secret n'est injecté au build ; `.env.production` sert uniquement à l'exécution.

```sh
docker compose config --quiet
docker compose build
docker compose run --rm --no-deps outbound-worker ./node_modules/.bin/prisma migrate deploy
# Initialiser les périodes historiques vérifiées avant d'ouvrir les envois.
docker compose up -d outbound-worker ai-worker
docker compose logs --tail=100 -f outbound-worker ai-worker
```

Pour le staging : `WORKER_ENV_FILE=.env.staging docker compose ...`. Isoler sa base, son instance WhatsApp et ses clés Stripe.

`localhost` à l'intérieur d'un worker désigne ce worker. Les hôtes `postgres` et `evolution-api` de l'exemple doivent être remplacés par les noms réels et joignables. Pour rejoindre un autre Compose, ajouter aux deux services un réseau Docker externe existant :

```yaml
networks:
  backend:
    external: true
    name: NOM_REEL_DU_RESEAU
```

Puis `networks: [backend]` sous chaque service. Ne pas publier PostgreSQL sur Internet. Dans le Compose Evolution existant, l'image fournie dans vos échanges peut être épinglée à :
`evoapicloud/evolution-api@sha256:6b195676b09abbbd8ac9372cd961674dea2587f23dc9bc1d1e6a595372556fb1`.
Cette image n'est pas ajoutée au Compose des workers pour ne pas créer une deuxième instance Evolution.

## Bascule et validation

1. Sauvegarder et vérifier la restauration ; tester sur staging.
2. Prévoir une ingestion durable pendant la maintenance ou une reprise des événements vérifiée avec Evolution.
3. Suspendre les anciens producteurs. Appliquer les migrations et reprendre les quotas.
4. Déployer ensemble l'application et le nouveau webhook : aucun appel IA ou sendText direct ne doit rester dans le webhook.
5. Valider la configuration de l’agent dans chaque projet concerné. Démarrer les workers. Envoyer un message depuis l'instance de test et vérifier : un entrant, un AiJob, un BOT, un OutboundJob, une réservation.
6. Vérifier un envoi agent, la reprise humaine, les doublons, la reconnexion, les accusés et les cas incertains, puis rouvrir les envois.

Stripe : activer `checkout.session.completed`, `customer.subscription.created/updated/deleted`, `invoice.paid` et `invoice.payment_failed`. La version du SDK installée expose l'abonnement via `invoice.parent.subscription_details` et les périodes via les lignes d'abonnement. L'ouverture d'un cycle payé nécessite une facture payée couvrant la période courante ; les relectures gardent la consommation. Une mise à jour de souscription relit l'état actuel de Stripe. Aucun message ne déclenche la fin anticipée d'un essai.

## Contrôles locaux et exploitation

```sh
npx prisma generate
npm run typecheck
npm test
npm run build
```

Les tests utilisent une base PostgreSQL PGlite en mémoire avec le pilote PostgreSQL de Prisma et n'utilisent jamais `DATABASE_URL`. Cela couvre les transactions, migrations et reprises ; les comportements de concurrence multi-connexion et l'API Evolution réelle restent à valider sur staging.

```sql
SELECT state, count(*) FROM ai_job GROUP BY state;
SELECT state, count(*) FROM outbound_job GROUP BY state;
SELECT "errorCode", count(*) FROM ai_job WHERE state IN ('FAILED', 'CANCELLED') GROUP BY "errorCode";
SELECT id, "projectId", "providerMessageId", "errorCode" FROM outbound_job WHERE state = 'UNCERTAIN';
SELECT "projectId", "key", "used", "limit", "startsAt", "endsAt" FROM quota_period WHERE "isCurrent";
```

Pour un résultat UNCERTAIN, rechercher la preuve fournisseur avant toute action. Ne pas remettre le job en QUEUED. Conserver les reçus non résolus jusqu'à rapprochement. La rétention et la supervision centralisée des erreurs sont à configurer selon votre exploitation.

## Réglages et contacts

Les mutations sont réservées aux OWNER/ADMIN ; portail Stripe et suppression du projet aux OWNER. Configurer le portail client Stripe avant utilisation. Les sauvegardes de l’agent et des paramètres utilisent une version pour détecter les modifications concurrentes. Le journal garde l’auteur, le type de changement et sa version, sans recopier les instructions.

Les options WhatsApp sont enregistrées comme état souhaité, puis appliquées par les workers via `settings/find` et `settings/set`. L’interface affiche « en attente » jusqu’à confirmation ; les échecs sont retentés après une minute. Vérifier le contrat de ces routes sur l’image Evolution déployée. L’indicateur de saisie utilise le paramètre `delay` du sendText v2 ; ce n’est pas une animation pendant toute la génération.

La suppression d’un projet refuse les envois en cours ou incertains, met le projet en pause, annule son abonnement puis supprime l’instance et les données locales. Un échec externe conserve les références et permet de réessayer. Les exports de contacts CSV/Excel sont limités à 10 000 lignes, protégés par rôle et isolés par projet. Les cellules CSV neutralisent les préfixes de formule ; les cellules Excel sont des chaînes.

Next.js et eslint-config-next ont été mis à jour vers 16.3.3, correctif officiel d’août 2026 : https://nextjs.org/blog/august-2026-security-release. Un audit des dépendances et des essais sur l’environnement réel restent nécessaires avant ouverture en production.

## Recette locale et facturation

La base de développement/test confirmée par l’utilisateur a été comparée au schéma cible le 15 septembre 2026. Les seules différences applicatives étaient celles des migrations durable_ai et agent_settings. Les trois migrations historiques ont été enregistrées comme référence avec `prisma migrate resolve`, puis les deux nouvelles migrations ont été appliquées avec `prisma migrate deploy`. Les compteurs des tables existantes sont restés identiques. Cette adoption du schéma ne doit pas être rejouée aveuglément sur une autre base.

`/projects/[projectId]/billing` consulte l’abonnement, le client et les factures Stripe de ce projet après contrôle du rôle OWNER/ADMIN. La gestion via portail est réservée au propriétaire. L’ancien `/projects/billing` permet de choisir un projet au lieu d’afficher des exemples fictifs. La consultation peut rester partielle si Stripe est indisponible. Les montants suivent les [unités monétaires de Stripe](https://docs.stripe.com/currencies) ; l’historique est [filtré par abonnement](https://docs.stripe.com/api/invoices/list).

Pour vérifier uniquement le modèle, avec une conversation fictive et sans envoi WhatsApp : `npx tsx scripts/check-ai.ts`. Ce test utilise la clé OpenRouter configurée et peut consommer quelques tokens. Le modèle initial configurable est [Gemini 2.5 Flash Lite](https://openrouter.ai/google/gemini-2.5-flash-lite). Le parcours complet à exécuter ensemble est décrit dans `docs/recette.md`.

## État des dépendances après correction

Next.js 16.3.3 et les mises à jour compatibles de `npm audit fix` sont installés ; Better Auth est verrouillé à 1.7.5 dans le lockfile. L’audit complet indique encore six alertes transitives : quatre de niveau élevé dans la chaîne Prisma (deepmerge-ts, mysql2 et leurs dépendants) et deux modérées dans la chaîne ExcelJS/uuid. L’application utilise PostgreSQL ; l’export utilise des cellules texte. Ces constats réduisent certains chemins d’exposition, mais ne constituent pas une preuve d’absence de risque. Ne pas appliquer `npm audit fix --force` sans préparer une migration majeure et la tester : npm propose notamment une rétrogradation de Prisma.

La suppression de compte partage désormais le nettoyage contrôlé des projets et ne supprime plus les références d’abonnement après une erreur externe. Les fonctions Evolution sont des modules réservés au serveur, et le champ `globalRole` n’accepte pas les entrées utilisateur.
