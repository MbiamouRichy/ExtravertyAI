# Facturation Polar

Polar est le seul fournisseur de paiement : abonnements, essais, portail client et factures. Stripe a été retiré de l'application ; aucune clé Stripe n'est lue.

Les colonnes `stripeCustomerId`, `stripeSubscriptionId`, `stripePriceId`, `stripeStatus` et `stripeCurrentPeriodEnd` gardent leur nom historique et contiennent les identifiants Polar. La colonne `billingProvider` vaut toujours `polar` (migration `202611090010_polar_only_billing`).

## Ordre de mise en service

1. Appliquer les migrations avec `npm run db:deploy` (fait automatiquement par le build Vercel en production et en préversion).
2. Créer le jeton, les produits et le webhook du bon environnement.
3. Renseigner les variables dans Vercel, puis redéployer.
4. Renseigner les mêmes variables sur le serveur du worker de facturation, puis le redémarrer.

Les anciennes variables `BILLING_PROVIDER` et `STRIPE_*` ne servent plus et peuvent être supprimées.

## Variables

| Variable | Valeur |
| --- | --- |
| `POLAR_SERVER` | `sandbox` en préversion, vide en production |
| `POLAR_ACCESS_TOKEN` | Jeton d'organisation |
| `POLAR_WEBHOOK_SECRET` | Secret de l'endpoint |
| `POLAR_STARTER_PRODUCT_ID` | Produit Starter |
| `POLAR_PRO_PRODUCT_ID` | Produit Pro |
| `POLAR_BUSINESS_PRODUCT_ID` | Produit Business |
| `POLAR_STARTER_CREDIT_PRODUCT_ID` | Recharge Starter (facultatif) |
| `POLAR_PRO_CREDIT_PRODUCT_ID` | Recharge Pro (facultatif) |
| `POLAR_BUSINESS_CREDIT_PRODUCT_ID` | Recharge Business (facultatif) |

Ne jamais mélanger un jeton sandbox et un jeton de production : ils ne voient pas les mêmes données.

## Réglages obligatoires de l'organisation

À faire dans le sandbox et en production :

- **Organization Settings → Subscriptions → Allow multiple subscriptions : activé.** Polar limite sinon un client à un abonnement actif, donc une adresse e-mail à un seul projet payant.
- **Settings → Customer Portal : désactiver le changement d'offre.** L'application le fait elle-même, projet par projet (formulaire « Changer d'offre » de la page Facturation), avec ses contrôles : droits, places d'équipe, titulaire du paiement. Le portail le permettrait sans ces contrôles, au milieu de tous les abonnements du client.
- **Organization Settings → Subscriptions : proration sur « Prorate & charge now ».** Un changement d'offre s'applique tout de suite, et la différence est prélevée immédiatement. Sans ce réglage, un client pourrait monter en Business, consommer le quota, puis résilier avant la facture suivante sans payer la différence. Un prélèvement refusé fait passer l'abonnement en retard de paiement, et l'application suspend les envois.

## Droits du jeton

`checkouts:read`, `checkouts:write`, `customer_sessions:write`, `customers:read`, `customers:write`, `products:read`, `subscriptions:read`, `subscriptions:write`, `orders:read`.

`subscriptions:write` sert à résilier l'abonnement quand un projet est supprimé. `customers:write` sert à effacer le client avec son dernier projet.

## Produits

Chaque forfait est un abonnement mensuel en USD, au prix de `lib/pricing.ts`. Un prix différent bloque le paiement avant la création du projet. L'essai de 5 jours (100 messages) est demandé par l'application au moment du paiement.

## Messages supplémentaires

Au-delà du quota mensuel (2 500, 8 000 ou 25 000 messages), un projet payant continue d’envoyer grâce à un crédit prépayé. Une recharge vaut 1 000 messages au tarif de l’offre : 8 $ en Starter, 6 $ en Pro, 5 $ en Business (`extraPackCents` de `lib/pricing.ts`).

**Produits à créer**, dans le sandbox puis en production : trois produits à **achat unique** (pas d’abonnement), en USD, à prix fixe de 8 $, 6 $ et 5 $. Ne pas y ajouter de prix à l’usage. Renseigner leurs identifiants dans `POLAR_*_CREDIT_PRODUCT_ID` sur Vercel. Un prix différent, un produit archivé ou récurrent rend l’achat indisponible. Sans ces variables, le bouton n’apparaît pas et l’envoi s’arrête au quota, comme avant.

**Pourquoi pas une facturation à l’usage Polar.** Les compteurs Polar sont tenus par client, et un client Polar (une adresse e-mail) paie souvent plusieurs projets, avec des offres différentes. L’usage d’un projet pourrait être facturé sur l’abonnement d’un autre, ou deux fois. Avec une recharge, rien n’est dû après coup.

**Règles appliquées par le serveur** (`lib/message-credit.ts`, `lib/message-quota.ts`) :

- le crédit est une somme, en dix-millièmes de dollar, et non un nombre de messages. Chaque message hors quota en retire le tarif de l’offre du moment. Changer d’offre ne le dévalue pas, et acheter en Business pour envoyer en Starter ne rapporte rien ;
- il n’est utilisé qu’une fois le quota de la période épuisé, sur une période payée, jamais pendant l’essai ;
- au plus le quota de l’offre en messages supplémentaires par période. Ce plafond borne le coût d’une boucle ;
- au plus 10 recharges d’avance par projet ;
- l’achat (`buyMessageCredit`) exige le droit Facturation et un abonnement payé à jour ;
- seul le webhook crédite : il relit la commande chez Polar, vérifie le produit, le projet (`metadata.projectId`) et le statut payé, puis crédite le montant hors taxes, une seule fois par commande (`message_credit_purchase`) ;
- un remboursement retire la part remboursée du crédit restant, sans descendre sous zéro ;
- le crédit n’expire pas. Il est perdu avec la suppression du projet.

Une recharge achetée hors de l’application (lien Polar direct) n’a pas de projet : elle est journalisée et doit être remboursée par le support.

## Webhook

URL de production : `https://www.extravertyai.com/api/webhooks/polar`. Elle doit viser `www` : Polar considère une redirection comme un échec et désactive l'endpoint après 10 échecs consécutifs.

Format `Raw`. Événements : tous les `subscription.*` et tous les `order.*`. Au minimum `subscription.created`, `subscription.active`, `subscription.updated`, `subscription.canceled`, `subscription.uncanceled`, `subscription.past_due`, `subscription.revoked`, `order.paid`, `order.refunded`.

L'application relit toujours l'abonnement chez Polar avant de l'appliquer. Les doublons et le désordre sont donc sans effet.

## Fonctionnement

| Fonction | Avec Polar |
| --- | --- |
| Changement d'offre | Formulaire de la page Facturation (`changeProjectPlan`). Offre supérieure : effet immédiat, différence prélevée tout de suite (`invoice`). Offre inférieure : au renouvellement (`next_period`), refusée si l'équipe dépasse les places de l'offre visée. Pendant l'essai : rien n'est prélevé et le quota d'essai ne change pas. Un changement programmé s'annule en choisissant de nouveau l'offre actuelle |
| Portail Polar | Il couvre tout le compte du payeur : ses cartes et tous ses abonnements, un client Polar par adresse e-mail. Il ne s'ouvre donc qu'au titulaire du paiement lui-même (adresse vérifiée identique), sur ses réglages de paiement. Un membre Facturation ou un nouveau propriétaire n'y a pas accès |
| Titulaire sans droits | Après un transfert de propriété, l'ancien propriétaire paie toujours. S'il n'a plus le droit de facturation sur le projet, l'offre ne peut plus être changée : le support reprend le paiement |
| Paiement en retard | « Régulariser le paiement » ouvre le portail au titulaire, qui met sa carte à jour, puis Polar relance le paiement |
| Résiliation | Bouton « Résilier l'abonnement » de l'application : en fin de période (essai compris, sans prélèvement), ou tout de suite si l'abonnement est impayé |
| Résiliation programmée | « Renouveler le plan » l'annule directement |
| Abonnement terminé | « Renouveler le plan » ouvre un nouveau paiement, sans nouvel essai |
| Carte enregistrée | Marque, 4 derniers chiffres et expiration affichés au propriétaire et au rôle Facturation (`GET /v1/customers/{id}/payment-methods`, droit `customers:read`). Sinon, visible dans le portail |
| Factures | Le PDF est généré à la première demande ; le client peut réessayer quelques instants après |

## Tests

Polar interdit les achats de test avec une vraie carte, même la sienne : ils déclenchent un blocage ou une revue de compte. Tester en sandbox avec `4242 4242 4242 4242`, ou en production avec un code de réduction à 100 %. Le versement vers la banque ne peut être prouvé que par un vrai client.
