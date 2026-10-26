# Tests de la Preview Vercel

URL : https://extraverty-ai-git-codex-preproduction-richy00s-projects.vercel.app

## Diagnostic initial (25 septembre 2026)

Une requête HEAD sans session sur `/api/webhooks/stripe` a reçu HTTP 302 vers `vercel.com/sso-api`. La protection Vercel bloque cet accès. Vérifier dans Stripe si la destination utilise cette URL sans mécanisme de bypass. Une connexion Vercel dans le navigateur n'autorise pas Stripe.

## Préparation

- Utiliser une base, un compte et un numéro WhatsApp de test ; Stripe et ses prix doivent appartenir au même sandbox/mode test.
- Dans Vercel Preview, définir `NEXT_PUBLIC_APP_URL` avec l'origine ci-dessus, puis redéployer.
- Dans Stripe, configurer une destination vers `/api/webhooks/stripe` sur cette Preview. Son secret de signature doit correspondre à `STRIPE_WEBHOOK_SECRET` dans Vercel Preview.
- Autoriser l'accès serveur de Stripe à la destination via les mécanismes de protection Vercel. Conserver la vérification de signature Stripe. Ne pas copier les secrets dans Git ou dans la conversation.
- Événements traités : `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.paid`, `invoice.payment_failed`.
- Configurer les limites `MESSAGE_LIMIT_STARTER`, `MESSAGE_LIMIT_PRO`, `MESSAGE_LIMIT_BUSINESS` pour les périodes payantes.

## Recette manuelle

| Action                                        | Résultat attendu                                               |
| --------------------------------------------- | -------------------------------------------------------------- |
| Visiter `/projects/new` déconnecté            | Redirection vers la connexion                                  |
| Se connecter avec le compte de test           | « Vos projets »                                                |
| Saisir des données invalides                  | Erreurs visibles, aucune création                              |
| Créer un projet avec un numéro de test inédit | Ouverture de Checkout en mode test                             |
| Ouvrir Stripe sans terminer Checkout          | Projet « Inactif »                                             |
| Terminer Checkout en mode test                | Retour sur la Preview ; livraison du webhook en HTTP 200       |
| Recharger `/projects` après le webhook        | « En essai », durée de 10 jours, quota initial de 150 messages |
| Rejouer le même événement depuis Stripe       | Statut conservé, consommation non remise à zéro                |
| Accéder au projet d'un autre compte           | Aucun accès aux données                                        |
| Refaire sur mobile                            | Actions accessibles et messages lisibles                       |

L'essai correspond à `trialing`, pas à `active`. La connexion WhatsApp est un état distinct. Ne jamais activer un projet sur le seul paramètre `success=true`.

Si le projet reste inactif, consulter la livraison Stripe `checkout.session.completed` :

- Aucune livraison : vérifier destination, événements et environnement Stripe.
- 3xx, 401 ou 403 : protection ou redirection avant le webhook.
- 404 : mauvaise destination ou déploiement.
- 400 : secret absent ou signature invalide.
- 503 : synchronisation échouée (prix, base, API Stripe ou quota).
- 200 mais toujours inactif après rechargement : vérifier `metadata.projectId`, abonnement et base de cette Preview.

Après correction, renvoyer l'événement depuis Stripe puis recharger `/projects`. Le retour vers la configuration de l'agent ne prouve pas l'activation.

## Tests automatisés

Créer `.env.e2e.local` (ignoré par Git) :

```dotenv
E2E_BASE_URL=https://extraverty-ai-git-codex-preproduction-richy00s-projects.vercel.app
# Pour utiliser Edge déjà installé si le téléchargement Chromium échoue :
# E2E_BROWSER_CHANNEL=msedge
# Facultatif pour les pages protégées :
# E2E_VERCEL_BYPASS_SECRET=...
# Si et seulement si ce bypass est aussi configuré dans la destination Stripe :
# E2E_STRIPE_WEBHOOK_BYPASS_SECRET=...
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

Les tests API vérifient l'accès à la Preview et le rejet des webhooks non signés ou mal signés. Aucun projet ou abonnement n'est créé. Les tests navigateur couvrent la validation de connexion et les accès protégés, sur ordinateur et mobile. La connexion réussie est ignorée sans compte de test.

Les tests du webhook n'héritent jamais du bypass du navigateur. Définir `E2E_STRIPE_WEBHOOK_BYPASS_SECRET` uniquement si la même valeur est effectivement configurée dans la destination Stripe. Les tests envoient ce secret par en-tête (équivalent au paramètre d'URL côté Vercel), pour éviter de l'inclure dans les URL des rapports. Sans cette variable, ils vérifient l'accès direct sans session. Ne pas publier les rapports contenant des informations de connexion.

`npm test` vérifie la synchronisation d'un projet inactif vers l'essai, le quota initial, les doublons et le renouvellement, dans PostgreSQL WASM isolé. Cela ne prouve pas la livraison réelle par Stripe : compléter avec la recette manuelle.

Les rapports sont locaux. Les traces, captures et vidéos sont désactivées pour éviter d'enregistrer les identifiants et secrets de bypass.

## Confirmation HTTP et accès Stripe

Le POST sans signature vers `/api/webhooks/stripe` a reçu **401** de Vercel. L'application devrait répondre 400 si la requête l'atteignait. Ce blocage est indépendant du paiement.

`/projects/new?canceled=true` est la page de retour après annulation de Checkout, jamais la destination d'un webhook.

Pour conserver la protection de la Preview, créer un secret dans Vercel → Deployment Protection → Protection Bypass for Automation, puis renseigner dans la configuration privée de la destination Stripe :

```text
https://extraverty-ai-git-codex-preproduction-richy00s-projects.vercel.app/api/webhooks/stripe?x-vercel-protection-bypass=SECRET_VERCEL
```

Remplacer le marqueur uniquement dans Stripe, sans partager le secret. Ce secret Vercel est distinct de `STRIPE_WEBHOOK_SECRET`, qui valide les signatures Stripe. Vérifier ce dernier dans les variables Preview puis redéployer si nécessaire. Renvoyer ensuite la livraison `checkout.session.completed`, attendre HTTP 200, puis recharger `/projects`.

Documentation Vercel : https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation

## Résultats de cette vérification

- 18 tests locaux réussis, dont le passage inactif → essai et le quota initial de 150 messages.
- Vérification TypeScript réussie.
- 9 scénarios Playwright découverts (3 API, 3 navigateur sur ordinateur et sur mobile).
- 3 tests API exécutés : bloqués par Vercel (connexion HTTP 302 ; webhooks HTTP 401).
- Parcours navigateur « création de projet déconnecté » exécuté avec Edge : redirigé vers `vercel.com/login`, avant d'atteindre l'application.
- Téléchargement Chromium échoué par délai réseau ; Edge installé utilisé à la place. Le fichier local `.env.e2e.local` a été initialisé si absent, sans secrets.

Les autres parcours navigateur et la recette Stripe complète restent à exécuter après configuration des accès. Aucun paiement, compte ou projet n'a été créé par cette vérification.
Le contrôle ESLint ciblé a été interrompu après une attente prolongée sans résultat ; il reste à relancer.
