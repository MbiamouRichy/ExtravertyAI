# Diffusion de messages

Envoi d’un même message, personnalisé avec le prénom, à des contacts WhatsApp existants. Disponible avec les offres **Pro** et **Business**, réservé aux propriétaires et administrateurs du projet.

## Limites par offre

| | Pro | Business |
|---|---|---|
| Contacts par diffusion | 500 | 2 000 |
| Messages de diffusion par période de facturation | 2 000 | 10 000 |
| Messages de diffusion par jour | 300 | 1 000 |

Chaque message de diffusion est aussi décompté du quota mensuel de messages de l’offre. Les limites sont définies dans `lib/plan-features.ts` et vérifiées côté serveur à la création **et** à chaque envoi.

## Règles de protection du numéro

- **Audience** : uniquement des contacts qui ont déjà écrit à l’entreprise (au moins un message client). Pas d’import de numéros : la prospection à froid entraîne signalements et blocage du numéro.
- **Désinscription** : la mention « Répondez STOP pour ne plus recevoir ces messages. » est ajoutée à chaque envoi. Un message STOP (ou ARRÊT, DÉSINSCRIRE…) exclut définitivement le contact des diffusions, START le réinscrit. Ces messages sont journalisés dans la conversation et l’IA n’y répond pas.
- **Rythme** : un message toutes les 8 à 15 secondes (aléatoire), entre 8 h et 20 h, heure de Libreville (`BROADCAST_WINDOW`, `BROADCAST_TIME_ZONE`). Hors de ces heures, ou une fois la limite quotidienne atteinte, l’envoi reprend à l’ouverture suivante.
- **Une seule diffusion active** (programmée, en cours ou en pause) par projet.

## Fonctionnement

- À la création, la liste des destinataires est figée (`broadcast_recipient`). Un contact désinscrit entre-temps est ignoré au moment de son tour.
- Le worker outbound exécute `broadcastLoop` : à chaque tour, `runBroadcastTick` crée **un** message (expéditeur : l’auteur de la diffusion, source `broadcast`) et sa tâche d’envoi, puis repousse la diffusion de 8 à 15 secondes. Les messages rejoignent la file d’envoi normale un par un : les conversations des autres projets ne sont jamais retardées.
- Arrêts automatiques (statut « En pause », alerte aux administrateurs dans les notifications) : quota atteint, limite mensuelle de diffusion, offre sans diffusion, projet en pause ou inactif, auteur parti du projet. Un administrateur peut reprendre la diffusion ; s’il le fait après le départ de l’auteur, les messages partent désormais à son nom.
- Attentes sans intervention : WhatsApp déconnecté (nouvel essai chaque minute), hors des heures d’envoi, limite quotidienne.
- L’IA garde son état sur chaque conversation : les réponses des clients sont traitées comme n’importe quel message.
- Statistiques : envoyés, distribués et lus d’après les accusés WhatsApp ; réponses = contacts qui ont écrit dans les 7 jours suivant leur message.
- Image facultative (JPEG, PNG, WebP, 4 Mo) importée par la route des pièces jointes, rangée sous `chat-media/<projet>/` : supprimée avec le projet, jamais considérée comme orpheline tant qu’une diffusion la référence.

## Espace Diffusions

- **/projects/<id>/broadcasts** : onglets « Diffusions » (utilisation du mois et du jour, liste avec progression et résultats) et « Désinscrits » (contacts ayant répondu STOP, en lecture seule : seul le client peut se réinscrire).
- **/projects/<id>/broadcasts/new** : rédaction avec variable {prénom}, image, ciblage avec décompte en direct, envoi immédiat ou programmé, aperçu et confirmation.
- **/projects/<id>/broadcasts/<diffusion>** : onglets « Vue d’ensemble » (entonnoir ciblés → envoyés → distribués → lus → réponses, message réellement envoyé avec son image, ciblage, journal), « Destinataires » (filtres par état, recherche par nom) et « Réponses » (messages reçus dans les 7 jours, liens vers la conversation).

## Sécurité

- Lecture ouverte à tous les membres du projet ; création, reprise, pause et annulation réservées aux propriétaires et administrateurs. Contrôles côté serveur à chaque page, action et route.
- Une diffusion d’un autre projet, ou un projet sans accès, répond « introuvable » : aucune information ne fuit. Les identifiants sont validés avant toute requête.
- Les numéros n’arrivent jamais complets dans le navigateur (numéro masqué) ; les réponses affichées sont tronquées à 500 caractères.
- Les recherches de noms passent par des actions serveur : aucun nom de client dans les URL, l’historique ou les journaux. Seul l’onglet ouvert figure dans l’adresse (?vue=).
- Requêtes SQL entièrement paramétrées ; la recherche est textuelle (les caractères % et _ ne sont pas des jokers).
- Le calcul d’audience est limité à 40 demandes par minute et par utilisateur (`lib/rate-limit.ts`, par instance).
- L’image est servie par `/api/projects/<id>/broadcasts/<diffusion>/media` après contrôle d’appartenance, sans cache, avec `nosniff` et une politique de sécurité en bac à sable.
- Les pages Diffusions interdisent l’affichage dans un cadre (`X-Frame-Options: DENY`, `frame-ancestors 'none'`) et limitent le référent au site (`next.config.ts`).
- Journal d’audit (`broadcast_event`) : création, démarrage, pauses manuelles et automatiques avec leur motif, reprises (dont reprise après départ de l’auteur), annulation, fin.

## Mise en production

1. Appliquer la migration `202610240001_broadcasts` (`npm run db:deploy`).
2. Redémarrer le **worker outbound** : c’est lui qui envoie les diffusions.
