# Tests de paiement Polar et Dodo

Ces tests comparent Polar et Dodo Payments avant toute migration. Ils tournent en local dans les environnements de test des deux fournisseurs. Ils ne touchent ni à la base de données, ni à l'application déployée.

Le sandbox valide l'abonnement et les webhooks, pas ton éligibilité au Gabon. Seuls une vérification d'identité complète et un premier versement réel le prouvent.

## 1. Préparer les comptes

Crée pour chaque fournisseur les forfaits Starter, Pro et Business, à prix mensuel en USD, identiques à ceux de `lib/pricing.ts`.

- **Polar :** crée un compte et une organisation sur [sandbox.polar.sh/start](https://sandbox.polar.sh/start), puis un jeton avec le droit `checkouts:write`.
- **Dodo :** active le mode test dans le tableau de bord, puis crée une clé commençant par `dodo_test_`.

Ajoute les valeurs à `.env`, jamais dans un fichier versionné :

```
PAYMENT_SANDBOX_EMAIL=
POLAR_SANDBOX_ACCESS_TOKEN=
POLAR_SANDBOX_WEBHOOK_SECRET=
POLAR_SANDBOX_STARTER_PRODUCT_ID=
POLAR_SANDBOX_PRO_PRODUCT_ID=
POLAR_SANDBOX_BUSINESS_PRODUCT_ID=
DODO_TEST_API_KEY=
DODO_TEST_WEBHOOK_KEY=
DODO_TEST_STARTER_PRODUCT_ID=
DODO_TEST_PRO_PRODUCT_ID=
DODO_TEST_BUSINESS_PRODUCT_ID=
```

Sur Polar, les e-mails de test n'arrivent qu'aux membres de l'organisation : utilise l'adresse de ton compte sandbox.

## 2. Recevoir les webhooks

Lance l'écouteur local, qui reste actif :

```bash
npm run payments:sandbox -- listen
```

### Sous Windows 10 : tunnel

Le CLI Polar s'installe sous macOS, Linux et WSL. Sous Windows 10, WSL 2 n'atteint pas directement le `localhost` de Windows : utilise un tunnel temporaire.

```bash
winget install Cloudflare.cloudflared
```

```bash
cloudflared tunnel --url http://localhost:4242
```

Dans Settings → Webhooks du sandbox Polar, crée un endpoint avec l'URL `https://<ton-tunnel>.trycloudflare.com/webhooks/polar`, le format `Raw` et un secret généré. Copie ce secret dans `POLAR_SANDBOX_WEBHOOK_SECRET`, puis relance l'écouteur.

L'URL change à chaque lancement du tunnel. Arrête-le avec Ctrl+C après les tests.

### Sous macOS ou Linux : CLI Polar

```bash
polar auth login --sandbox
```

```bash
polar webhook listen http://localhost:4242/webhooks/polar
```

Copie le secret affiché au démarrage dans `POLAR_SANDBOX_WEBHOOK_SECRET`, puis relance l'écouteur.

### Dodo

Le plus simple sous Windows est de réutiliser le tunnel : crée un endpoint de test Dodo vers `https://<ton-tunnel>.trycloudflare.com/webhooks/dodo`, puis copie sa clé de signature dans `DODO_TEST_WEBHOOK_KEY`.

Ailleurs, relaie Dodo avec le [CLI Dodo](https://docs.dodopayments.com/developer-resources/sdks/cli), après `dodo login` en mode test :

```bash
dodo wh listen
```

Les événements de `dodo wh trigger` ne sont pas signés : l'écouteur les refuse, c'est normal.

## 3. Lancer un paiement

```bash
npm run payments:sandbox -- checkout polar starter
```

```bash
npm run payments:sandbox -- checkout dodo starter
```

Ouvre l'URL affichée et paie avec `4242 4242 4242 4242`, une date future et n'importe quel CVC. Sur Dodo, utilise 06/32 et 123. Les fournisseurs peuvent exiger une adresse de facturation.

## 4. Scénarios à valider

Chaque événement s'affiche en JSON. `missing` liste les champs attendus par la synchronisation et absents de l'événement.

Pour atteindre le premier prélèvement sans attendre 10 jours, ajoute `PAYMENT_SANDBOX_TRIAL_DAYS=1` à `.env`, puis crée un nouveau paiement. Garde le tunnel et l'écouteur actifs jusqu'à la fin de l'essai.

Résultats Polar du 31 octobre 2026 : `subscription.active` arrive dès le début de l'essai, avec le statut `trialing`. Une commande `paid` arrive aussi à ce moment. Une migration devra donc se fier au statut et au montant, pas au seul nom de l'événement.

| Scénario | Ce qu'il faut vérifier |
| --- | --- |
| Essai de 10 jours | Carte demandée, statut d'essai et fin d'essai corrects |
| `projectId` | Présent sur les événements d'abonnement : la doc Dodo ne le garantit pas |
| Conversion et renouvellement | Nouvelle période et date de fin reçues |
| Paiement refusé | Événement d'échec reçu, avec une période de grâce connue |
| Annulation | Annulation immédiate et fin de période distinguées |
| Doublons et ordre | Rejeu ignoré, horodatage disponible pour trier |
| Portail client | Mise à jour de la carte et annulation possibles |

Pour déclencher un prélèvement Dodo dans 3 minutes, ou un autre délai en minutes :

```bash
npm run payments:sandbox -- dodo-bill-soon SUB_ID 3
```

Pour un échec de renouvellement sur Dodo, enregistre d'abord la carte `4000 0000 0000 0341` (12/34, 123) dans le portail client.

Pour annuler un abonnement Dodo, immédiatement ou en fin de période :

```bash
npm run payments:sandbox -- dodo-cancel SUB_ID now
```

```bash
npm run payments:sandbox -- dodo-cancel SUB_ID period-end
```

Les abonnements de test Dodo continuent à se renouveler : annule-les à la fin.
