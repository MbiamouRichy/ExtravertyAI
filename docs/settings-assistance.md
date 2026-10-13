# Paramètres, suppression et assistance IA

## Suppression du compte

La suppression exige une session créée depuis moins de dix minutes, vérifiée côté serveur depuis la session autoritative Better Auth. Une actualisation de session ne remet pas ce délai à zéro. Les appels directs, y compris les anciens callbacks par e-mail, passent par cette vérification. Le mot de passe et l'e-mail de confirmation ne sont plus les étapes de ce parcours. Une ancienne session doit se déconnecter puis se reconnecter ; la suppression doit ensuite être confirmée à nouveau. Les nettoyages Stripe et WhatsApp existants restent exécutés.

## Suppression d'un projet

Le propriétaire télécharge d'abord CSV et Excel depuis la fenêtre de suppression, puis vérifie que les deux fichiers sont enregistrés. Ces exports contiennent tous les contacts du projet (nom, nom WhatsApp, téléphone, état de l'assistant, date de création), pas les conversations. Il n'y a plus de troncature à 10 000 contacts. Excel répartit plus d'un million de contacts sur plusieurs feuilles.

Chaque réponse d'export fournit une preuve signée avec `BETTER_AUTH_SECRET`, liée au propriétaire, au projet, au format et à l'empreinte des contacts. La suppression exige les deux preuves, valides dix minutes, et refuse si les contacts ont changé depuis leur export. Le navigateur ne permet pas au serveur de vérifier l'enregistrement effectif sur disque : l'utilisateur doit contrôler ses téléchargements avant la confirmation finale. Les exports sont des instantanés avant suppression ; de nouveaux messages peuvent arriver pendant le nettoyage des services externes. Le contrôle de connexion récente et la confirmation du nom restent obligatoires.

## Éditeur de message système

Cliquer sur le champ ouvre une fenêtre éditable. La sauvegarde existante est déclenchée après 600 ms sans frappe, sérialise les écritures et vérifie la version en base. Fermer la fenêtre déclenche immédiatement les modifications en attente. Les textes invalides ou erreurs de sauvegarde restent signalés. Pendant l'onboarding, la sauvegarde reste effectuée à la validation de la configuration complète.

Les boutons Générer et Reformuler utilisent `OPENROUTER_MODEL` et `OPENROUTER_API_KEY` existants. Seuls le nom du projet, les réglages de l'agent et le brouillon sont transmis, jamais les identifiants techniques du projet ni les conversations. Le cadre reprend identité, ton, connaissances vérifiées, vente progressive, validation et relais humain. Il n'importe pas les tarifs, l'identité ou les outils de l'exemple ExtravertyAI dans un autre projet. La reformulation conserve les informations métier. Une proposition remplace le texte et suit la sauvegarde habituelle ; un bouton permet de revenir au texte précédent.

## Protection des coûts des deux nouveaux boutons

- Réservations en base dans `ai_editor_request`, avec verrous utilisateur puis projet : plusieurs onglets, administrateurs et instances serveur partagent les limites.
- Un appel en cours par utilisateur ou projet, avec réservation de 90 secondes ; délai fournisseur de 45 secondes.
- Au moins 30 secondes entre les demandes.
- Maximum 10 tentatives par projet et 20 par utilisateur sur 24 heures glissantes, génération et reformulation réunies.
- Autorisation OWNER/ADMIN et accès de facturation vérifiés avant appel.
- Brouillon limité à 12 000 caractères, sortie à 6 000 tokens puis validation de 40 à 12 000 caractères ; réponse réseau bornée.
- Pas de relance fournisseur automatique. Les échecs consomment une tentative pour éviter les boucles coûteuses.
- Boutons et édition verrouillés pendant l'appel ; une réponse invalide conserve le brouillon.

Pour aller plus loin : ajouter un cache par empreinte du brouillon et des réglages, ainsi qu'un plafond budgétaire global chez le fournisseur. Les quotas ci-dessus concernent les deux nouveaux boutons de l'éditeur ; les autres fonctionnalités IA conservent leurs protections actuelles.

Appliquer la migration `202610120001_ai_editor_request` avant activation. Le registre de limites est indépendant des projets : supprimer puis recréer un projet ne réinitialise pas le quota utilisateur. Il contient uniquement des identifiants, états et dates ; les entrées de plus de 48 heures sont purgées lors des demandes suivantes. Les tests n'envoient aucune requête payante au fournisseur et ne suppriment aucun compte réel.
