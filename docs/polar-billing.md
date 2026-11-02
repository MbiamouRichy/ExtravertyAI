# Facturation Polar

Polar encaisse les nouveaux abonnements quand `BILLING_PROVIDER=polar`. Sans cette variable, l'application reste sur Stripe. Un abonnement existant garde le fournisseur enregistré dans `billingProvider`.

## Ordre de mise en service

1. Appliquer la migration `202611020001_polar_billing` avec `npm run db:deploy`, avant de déployer le code : il lit la nouvelle colonne `billingProvider`.
2. Créer le jeton, les produits et le webhook du bon environnement.
3. Renseigner les variables dans Vercel, puis redéployer.
4. Renseigner les mêmes variables sur le serveur du worker de facturation, puis le redémarrer.
5. Passer `BILLING_PROVIDER=polar` en dernier.

Pour revenir en arrière, remettre `BILLING_PROVIDER=stripe`. Les abonnements Polar déjà créés restent gérés par Polar.

## Variables

| Variable | Valeur |
| --- | --- |
| `BILLING_PROVIDER` | `polar` |
| `POLAR_SERVER` | `sandbox` en préversion, vide en production |
| `POLAR_ACCESS_TOKEN` | Jeton d'organisation |
| `POLAR_WEBHOOK_SECRET` | Secret de l'endpoint |
| `POLAR_STARTER_PRODUCT_ID` | Produit Starter |
| `POLAR_PRO_PRODUCT_ID` | Produit Pro |
| `POLAR_BUSINESS_PRODUCT_ID` | Produit Business |

Ne jamais mélanger un jeton sandbox et un jeton de production : ils ne voient pas les mêmes données.

## Réglages obligatoires de l'organisation

À faire dans le sandbox et en production :

- **Organization Settings → Subscriptions → Allow multiple subscriptions : activé.** Polar limite sinon un client à un abonnement actif, donc une adresse e-mail à un seul projet payant.
- **Settings → Customer Portal : autoriser le changement d'offre.** Le bouton « Changer d'offre » ouvre ce portail.
- **Organization Settings → Subscriptions : proration par défaut sur `prorate`.** Un changement d'offre s'applique tout de suite, et la différence va sur la prochaine facture.

## Droits du jeton

`checkouts:read`, `checkouts:write`, `customer_sessions:write`, `customers:read`, `customers:write`, `products:read`, `subscriptions:read`, `subscriptions:write`, `orders:read`.

`subscriptions:write` sert à résilier l'abonnement quand un projet est supprimé. `customers:write` sert à effacer le client avec son dernier projet.

## Produits

Chaque forfait est un abonnement mensuel en USD, au prix de `lib/pricing.ts`. Un prix différent bloque le paiement avant la création du projet. L'essai de 10 jours est demandé par l'application au moment du paiement.

## Webhook

URL de production : `https://www.extravertyai.com/api/webhooks/polar`. Elle doit viser `www` : Polar considère une redirection comme un échec et désactive l'endpoint après 10 échecs consécutifs.

Format `Raw`. Événements : `subscription.created`, `subscription.active`, `subscription.updated`, `subscription.canceled`, `subscription.uncanceled`, `subscription.past_due`, `subscription.revoked`, `order.paid`, `order.refunded`.

L'application relit toujours l'abonnement chez Polar avant de l'appliquer. Les doublons et le désordre sont donc sans effet.

## Différences avec Stripe

| Fonction | Avec Polar |
| --- | --- |
| Paiement en retard | Le client met sa carte à jour dans le portail, puis Polar relance le paiement |
| Résiliation programmée | « Renouveler le plan » l'annule directement |
| Abonnement terminé | « Renouveler le plan » ouvre un nouveau paiement, sans nouvel essai |
| Carte enregistrée | Non affichée dans l'application : le jeton d'organisation n'y a pas accès. Elle reste visible dans le portail |
| Factures | Le PDF est généré à la première demande ; le client peut réessayer quelques instants après |

Le code Stripe reste en place pour un retour en arrière : garder `STRIPE_SECRET_KEY` dans Vercel et sur le worker.

## Tests

Polar interdit les achats de test avec une vraie carte, même la sienne : ils déclenchent un blocage ou une revue de compte. Tester en sandbox avec `4242 4242 4242 4242`, ou en production avec un code de réduction à 100 %. Le versement vers la banque ne peut être prouvé que par un vrai client.
