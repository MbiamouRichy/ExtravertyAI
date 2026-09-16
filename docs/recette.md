# Recette complète de l’application

Utiliser la base et les comptes de test, une instance WhatsApp dédiée et Stripe en mode test. Les scénarios ci-dessous ne sont pas marqués réussis tant qu’ils n’ont pas été exécutés dans le navigateur.

| Parcours            | Vérifications                                                                 | Résultat attendu                                                         |
| ------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Site public         | Accueil, Contact, À propos ; desktop et mobile ; clair/sombre                 | Thème Neutral, navigation et focus lisibles, aucun débordement           |
| Contact             | Champs requis, choix du besoin, lien WhatsApp, e-mail, téléphone              | Brouillon correct ; aucun message envoyé sans validation dans WhatsApp   |
| Compte              | Inscription, vérification e-mail, connexion, déconnexion, mot de passe oublié | Accès protégé, erreurs compréhensibles, liens valides                    |
| Nouveau projet      | Création et paiement Stripe de test, retour et paiement annulé                | Pas de doublon, configuration agent proposée avant le chat               |
| Agent               | Nom, instructions, tons, langue, longueur, comportements                      | Valeurs conservées après rechargement ; aperçu explicitement illustratif |
| Agent concurrent    | Deux onglets modifient le même agent                                          | Le second enregistrement obsolète est refusé                             |
| WhatsApp            | Connexion, QR code, reconnexion, options de présence/lecture                  | État réel ; synchronisation en attente puis confirmée ou erreur visible  |
| Chat                | Entrant puis réponse IA, envoi manuel, reprise humaine                        | Une seule réponse ; quotas cohérents ; IA arrêtée pour le contact repris |
| Quotas              | Doublon, limite atteinte, fin d’essai, renouvellement Stripe de test          | Aucun double débit ; aucun envoi hors période autorisée                  |
| Contacts            | Recherche, filtres, tri, pagination, alias, conversation directe              | Résultats du bon projet ; ouverture du contact choisi                    |
| Exports             | CSV et Excel ; noms commençant par =, +, -, @                                 | Données exactes, aucun contenu transformé en formule                     |
| Équipe              | Invitation, rôle, retrait ; compte sans appartenance                          | Droits respectés côté serveur ; aucune donnée d’un autre projet          |
| Réglages            | Nom, pause/reprise IA, instructions, journal                                  | Enregistrement réel ; aucune modification artificielle de l’abonnement   |
| Facturation         | Offre, période, quota, moyen masqué, factures, pagination, PDF                | Données Stripe du bon abonnement ; gestion réservée au propriétaire      |
| Stripe indisponible | Coupure simulée en environnement de test                                      | État local visible et message d’indisponibilité, aucun montant inventé   |
| Suppression         | Projet jetable uniquement ; échec fournisseur simulé                          | Confirmation du nom ; arrêt sûr et références conservées en cas d’échec  |

Tests automatisés : `npm test`, `npm run typecheck`, `npm run build`.
Les tests de messagerie utilisent une base isolée et des appels fournisseurs simulés. Ils ne remplacent pas la recette Stripe/WhatsApp réelle.

## Vérifications du 16 septembre 2026

- 18 tests automatisés réussis ; vérification TypeScript et contrôle ESLint ciblé réussis.
- Compilation de production réussie avec Next.js 16.3.3 (Webpack), après les mises à jour des dépendances.
- Serveur local démarré sur `http://127.0.0.1:3000` ; réponses HTTP 200 pour `/contact`, `/apropos`, `/projects`, `/projects/billing` et `/sign-in`. Ce contrôle de disponibilité ne valide pas les parcours connectés ni le rendu visuel.
- Stripe configuré en mode test. La connexion TikTok manque encore de ses identifiants.
- Recette visuelle et parcours WhatsApp réels à effectuer ensemble ; aucun worker n’a été lancé pour envoyer des messages aux contacts existants.
