# Tests de la Preview Vercel

URL : https://extraverty-ai-git-codex-preproduction-richy00s-projects.vercel.app

## Diagnostic initial (25 septembre 2026)

Une requête HEAD sans session sur l'ancien webhook de paiement a reçu HTTP 302 vers `vercel.com/sso-api`. La protection Vercel bloque cet accès : un service de paiement ne franchit pas la protection sans mécanisme de bypass. Une connexion Vercel dans le navigateur ne l'autorise pas.

## Préparation

- Utiliser une base, un compte et un numéro WhatsApp de test ; le jeton, les produits et le webhook Polar doivent appartenir au même sandbox (`POLAR_SERVER=sandbox`).
- Dans Vercel Preview, définir `NEXT_PUBLIC_APP_URL` avec l'origine ci-dessus, puis redéployer.
- Dans le sandbox Polar, créer un webhook vers `/api/webhooks/polar` sur cette Preview, au format `Raw`. Son secret doit correspondre à `POLAR_WEBHOOK_SECRET` dans Vercel Preview.
- Autoriser l'accès serveur de Polar via les mécanismes de protection Vercel. Conserver la vérification de signature. Ne pas copier les secrets dans Git ou dans la conversation.
- Événements traités : tous les `subscription.*` et `order.*` (voir [Facturation Polar](polar-billing.md)).
- Configurer les limites `MESSAGE_LIMIT_STARTER`, `MESSAGE_LIMIT_PRO`, `MESSAGE_LIMIT_BUSINESS` pour les périodes payantes.

## Recette manuelle

| Action                                        | Résultat attendu                                               |
| --------------------------------------------- | -------------------------------------------------------------- |
| Visiter `/projects/new` déconnecté            | Redirection vers la connexion                                  |
| Se connecter avec le compte de test           | « Vos projets »                                                |
| Saisir des données invalides                  | Erreurs visibles, aucune création                              |
| Créer un projet avec un numéro de test inédit | Ouverture du paiement Polar du sandbox                         |
| Quitter le paiement sans le terminer          | Projet « Inactif »                                             |
| Payer avec la carte `4242 4242 4242 4242`     | Retour sur la Preview ; livraison du webhook en HTTP 200       |
| Recharger `/projects` après le webhook        | « En essai », durée de 10 jours, quota initial de 150 messages |
| Rejouer le même événement depuis Polar        | Statut conservé, consommation non remise à zéro                |
| Accéder au projet d'un autre compte           | Aucun accès aux données                                        |
| Refaire sur mobile                            | Actions accessibles et messages lisibles                       |

L'essai correspond à `trialing`, pas à `active`. La connexion WhatsApp est un état distinct. Ne jamais activer un projet sur le seul paramètre `success=true`.

Si le projet reste inactif, consulter les livraisons du webhook dans Polar (`subscription.created`, `subscription.active`) :

- Aucune livraison : vérifier le webhook, ses événements et l'environnement (sandbox ou production).
- 3xx, 401 ou 403 : protection ou redirection avant le webhook.
- 404 : mauvaise destination ou déploiement.
- 400 : signature invalide.
- 503 « Webhook unavailable » : `POLAR_WEBHOOK_SECRET` absent.
- 503 « Retry required » : synchronisation échouée (produit inconnu, base, API Polar ou quota).
- 200 mais toujours inactif après rechargement : vérifier `metadata.projectId`, l'abonnement et la base de cette Preview.

Après correction, renvoyer l'événement depuis Polar puis recharger `/projects`. Le retour vers la configuration de l'agent ne prouve pas l'activation.

## Tests automatisés

Créer `.env.e2e.local` (ignoré par Git) :

```dotenv
E2E_BASE_URL=https://extraverty-ai-git-codex-preproduction-richy00s-projects.vercel.app
# Pour utiliser Edge déjà installé si le téléchargement Chromium échoue :
# E2E_BROWSER_CHANNEL=msedge
# Facultatif pour les pages protégées :
# E2E_VERCEL_BYPASS_SECRET=...
# Si et seulement si ce bypass est aussi configuré dans le webhook Polar :
# E2E_WEBHOOK_BYPASS_SECRET=...
# Facultatif pour la connexion réussie :
# E2E_EMAIL=...
# E2E_PASSWORD=...
```

```powershell
npm ci
npx playwright install chromium
npm test
npm run test:e2e:api
npm run test:e2e
npm run test:e2e:report
```

Les tests API vérifient l'accès à la Preview et le rejet d'un webhook mal signé. Aucun projet ou abonnement n'est créé. Les tests navigateur couvrent la validation de connexion et les accès protégés, sur ordinateur et mobile. La connexion réussie est ignorée sans compte de test.

Les tests du webhook n'héritent jamais du bypass du navigateur. Définir `E2E_WEBHOOK_BYPASS_SECRET` uniquement si la même valeur est effectivement configurée dans le webhook Polar. Les tests envoient ce secret par en-tête (équivalent au paramètre d'URL côté Vercel), pour éviter de l'inclure dans les URL des rapports. Sans cette variable, ils vérifient l'accès direct sans session. Ne pas publier les rapports contenant des informations de connexion.

`npm test` vérifie la synchronisation d'un projet inactif vers l'essai, le quota initial, les doublons et le renouvellement, dans PostgreSQL WASM isolé. Cela ne prouve pas la livraison réelle par Polar : compléter avec la recette manuelle.

Les rapports sont locaux. Les traces, captures et vidéos sont désactivées pour éviter d'enregistrer les identifiants et secrets de bypass.

## Accès de Polar à la Preview

Le POST sans signature vers l'ancien webhook de paiement a reçu **401** de Vercel. L'application devrait répondre 400 si la requête l'atteignait. Ce blocage est indépendant du paiement.

`/projects/new?canceled=true` est la page de retour après abandon du paiement, jamais la destination d'un webhook.

Pour conserver la protection de la Preview, créer un secret dans Vercel → Deployment Protection → Protection Bypass for Automation, puis renseigner dans le webhook Polar :

```text
https://extraverty-ai-git-codex-preproduction-richy00s-projects.vercel.app/api/webhooks/polar?x-vercel-protection-bypass=SECRET_VERCEL
```

Remplacer le marqueur uniquement dans Polar, sans partager le secret. Ce secret Vercel est distinct de `POLAR_WEBHOOK_SECRET`, qui valide les signatures. Vérifier ce dernier dans les variables Preview puis redéployer si nécessaire. Renvoyer ensuite la livraison, attendre HTTP 200, puis recharger `/projects`.

Documentation Vercel : https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation

## Résultats de cette vérification

- 18 tests locaux réussis, dont le passage inactif → essai et le quota initial de 150 messages.
- Vérification TypeScript réussie.
- 9 scénarios Playwright découverts (3 API, 3 navigateur sur ordinateur et sur mobile).
- 3 tests API exécutés : bloqués par Vercel (connexion HTTP 302 ; webhooks HTTP 401).
- Parcours navigateur « création de projet déconnecté » exécuté avec Edge : redirigé vers `vercel.com/login`, avant d'atteindre l'application.
- Téléchargement Chromium échoué par délai réseau ; Edge installé utilisé à la place. Le fichier local `.env.e2e.local` a été initialisé si absent, sans secrets.

Les autres parcours navigateur et la recette de paiement complète restent à exécuter après configuration des accès. Aucun paiement, compte ou projet n'a été créé par cette vérification.
Le contrôle ESLint ciblé a été interrompu après une attente prolongée sans résultat ; il reste à relancer.
