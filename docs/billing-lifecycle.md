# Fin d’essai, abonnement et notifications

## Comportement

- L’accès aux envois et aux fonctions IA exige un statut facturable `active` ou `trialing` et une période de quota courante, commencée et non expirée. L’horloge de PostgreSQL fait foi ; à l’instant exact de fin, l’accès expire.
- Les résumés, l’assistance à la rédaction et la qualification IA sont soumis à cette vérification. Une pause manuelle de l’automatisation ne suspend pas l’abonnement.
- Aucun quota payant n’est accordé avant une facture Stripe payée correspondant au cycle. Il n’y a pas de période de grâce implicite.
- Le bandeau du projet distingue essai terminé, paiement à régulariser, confirmation en attente et pause manuelle. Il se réactualise toutes les 30 secondes, au retour sur l’onglet et à l’échéance. Les échéances sont affichées avec heure et fuseau UTC.
- La lecture de l’historique et la facturation restent accessibles. Cette évolution ne supprime ni les données ni l’instance WhatsApp.

## Emails aux propriétaires

Le worker prépare un email par propriétaire (`OWNER`), période, échéance et type :

1. Un rappel pendant les trois derniers jours de l’essai (un seul rappel, pas un email par jour).
2. Une alerte lorsque l’accès expire sans période valide de remplacement, ou lorsqu’un paiement en retard/impayé ou une résiliation suspend l’accès.

Une conversion payante déjà confirmée ne déclenche pas d’alerte d’expiration. Les notifications devenues obsolètes sont annulées avant envoi. Le worker vérifie de nouveau le rôle du destinataire, son adresse et l’état du projet ; les administrateurs et membres ordinaires ne reçoivent pas ces emails. Le lien pointe vers la facturation authentifiée, sans jeton de portail Stripe dans l’email.

Les emails sont en texte brut : les noms des projets ne sont jamais interprétés comme du HTML. La file contient l’adresse et le contenu nécessaires à l’envoi ; elle est supprimée avec le projet.

## Activation en production

1. Déployer cette version et appliquer les migrations avec `npm run db:deploy` sur la base cible avant de démarrer les nouvelles instances web/workers.
2. Régénérer le client Prisma (déjà fait dans le build web et Docker) : `npx prisma generate`.
3. Dans l’environnement du worker, configurer :
   - `DATABASE_URL`
   - `STRIPE_SECRET_KEY` dans le même mode test/réel que l’application
   - `STRIPE_STARTER_PLAN_ID`, `STRIPE_PRO_PLAN_ID`, `STRIPE_BUSINESS_PLAN_ID`
   - `STRIPE_STARTER_LEGACY_PRICE_IDS`, `STRIPE_PRO_LEGACY_PRICE_IDS`, `STRIPE_BUSINESS_LEGACY_PRICE_IDS` facultatifs : anciens tarifs vérifiés de chaque offre, séparés par des virgules. Conserver les identifiants actuels pour les nouveaux achats.
   - `MESSAGE_LIMIT_STARTER`, `MESSAGE_LIMIT_PRO`, `MESSAGE_LIMIT_BUSINESS`
   - `RESEND_API_KEY`
   - `NEXT_PUBLIC_APP_URL` : origine HTTPS publique de l’application
   - `BILLING_EMAIL_FROM` facultatif : défaut `ExtravertyAI <notification@extravertyai.com>`, expéditeur à vérifier chez Resend
   - Variables Pusher facultatives pour la notification temps réel.
4. Lancer le service persistant : `docker compose up -d --build billing-worker`, ou `npm run worker:billing` sous le superviseur habituel.
5. Conserver le webhook Stripe et lui transmettre `customer.subscription.created`, `updated`, `deleted`, `trial_will_end`, `checkout.session.completed`, `invoice.paid`, `invoice.payment_succeeded`, `invoice.payment_failed`, `invoice.payment_action_required` et `invoice.finalization_failed`.

La fin d’essai bloque les opérations même si ce worker ou Stripe est momentanément indisponible. **Les emails et le rattrapage automatique nécessitent le worker en fonctionnement.** Aucune tâche planifiée Vercel supplémentaire n’est nécessaire.

Le worker refuse de démarrer si les offres ou quotas sont absents. Si Stripe répond mais que la synchronisation échoue (tarif inconnu, conflit de données), aucune nouvelle alerte n’est préparée depuis cet état obsolète ; corriger la configuration puis laisser le worker réessayer.

Le worker traite les projets à tour de rôle, généralement au moins une fois toutes les cinq minutes (hors backlog ou indisponibilité). Les webhooks rendent un projet immédiatement éligible au prochain passage. La réconciliation relit Stripe mais ne fabrique jamais de nouvel horodatage d’événement. Un numéro de révision empêche un résultat ancien de réconciliation d’écraser un webhook concurrent.

Au premier lancement, les projets déjà expirés disposant d’une période courante sont aussi traités : leurs propriétaires pourront recevoir une alerte de rattrapage. Les projets dont le Checkout n’a jamais ouvert de quota ne sont pas concernés.

## Fiabilité et exploitation

La table `billing_email` conserve les états `PENDING`, `SENDING`, `SENT`, `CANCELLED` et `REVIEW_REQUIRED`.

- Contrainte unique par notification ; acquisition atomique avec `SKIP LOCKED` et bail de deux minutes.
- Relances avec délai croissant, contenu immuable et clé Resend `billing/<id>`.
- Timeout HTTP de 20 secondes ; aucune transaction SQL maintenue pendant les requêtes réseau.
- Resend ne conserve les clés d’idempotence que 24 heures. Après 23 heures depuis la première tentative, un envoi non confirmé passe en `REVIEW_REQUIRED` sans nouvel envoi automatique. Vérifier dans Resend s’il a été accepté avant toute intervention manuelle. Ne pas réinitialiser aveuglément ces lignes.
- `SENT` signifie accepté par Resend, pas une garantie de livraison en boîte de réception. Consulter Resend pour les rejets et les bounces.
- Surveiller les logs `[billing-worker]`, l’âge des emails en attente et les lignes `REVIEW_REQUIRED`. Les logs ne contiennent ni corps d’email, ni adresse, ni secret.
- Le mode test Stripe ne rend pas les emails Resend fictifs. Utiliser des destinataires de test pendant les validations.

Documentation de l’idempotence Resend : https://resend.com/docs/dashboard/emails/idempotency-keys

## Validation

`node --import tsx --test tests/billing-lifecycle.test.ts tests/messaging.test.ts`

Les tests utilisent PostgreSQL WASM (PGlite), des réponses Stripe simulées et un expéditeur injecté. Ils ne lisent pas une base de production et n’envoient aucun email. Ils couvrent l’échéance exacte, les restrictions IA, les messages en attente, les rappels, la déduplication, les retries, les anciens propriétaires, la panne Stripe, les webhooks concurrents et la reprise après paiement.
