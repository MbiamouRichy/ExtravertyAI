# Relances automatiques

Relance d’un prospect resté silencieux, au bon moment, par l’IA ou avec le message de l’équipe. Disponible avec l’offre **Business** (`followUps` dans `lib/plan-features.ts`), réglée par les propriétaires et administrateurs depuis la page **Pipeline** (« Configurer »). Désactivée par défaut.

## Réglages

| Réglage | Valeurs | Par défaut |
|---|---|---|
| Relances activées | oui / non | non |
| Délai pour un prospect « Intéressé » | ne pas relancer, 1, 2, 3, 5, 7 ou 14 jours | 1 jour |
| Délai pour un prospect « Devis envoyé » | idem | 2 jours |
| Relances au plus par prospect | 1 à 3 | 2 |
| Message de l’équipe | vide (l’IA rédige) ou 10 à 500 caractères, variable `{prénom}` | vide |

Les bornes sont validées par Zod (`FollowUpSettingsSchema`, `lib/follow-ups-shared.ts`) dans le formulaire **et** côté serveur, sous verrou du projet, puis par des contraintes `CHECK` en base. Activer demande l’offre Business ; couper les relances reste possible après un changement d’offre, et les réglages sont conservés.

## Qui est relancé

Un contact à l’étape « Intéressé » ou « Devis envoyé » du pipeline, quand toutes ces conditions sont réunies :

- **Délai écoulé** depuis le dernier échange (dans un sens ou dans l’autre ; un envoi échoué ne compte pas), et dépassé depuis moins de 3 jours : activer la fonction ne réveille pas des conversations anciennes.
- **Le client n’attend pas de réponse** : sa dernière demande a reçu une réponse, ou l’IA l’a volontairement laissée sans suite (« merci », « je vais réfléchir »). Une relance ne remplace jamais une réponse due.
- **L’IA est active** sur la conversation (aucun membre n’a repris la main), le client n’a pas écrit STOP, la conversation n’est pas résolue.
- **Moins de relances que le maximum** depuis le dernier message du client : sa réponse remet le compteur à zéro.
- **Aucun envoi ni réponse de l’IA en cours** pour ce contact.
- Projet connecté à WhatsApp, agent configuré, automatisations actives, abonnement actif ou en essai, quota de messages disponible.

## Rythme et protection du numéro

- Envois entre 8 h et 20 h, heure du fuseau du projet (`nextSendingWindow`).
- 150 relances au plus par 24 heures et par projet (`followUpDaily`), et 20 secondes au moins entre deux relances d’un même projet.
- Chaque relance consomme un message du quota mensuel. Quota épuisé : aucune rédaction n’est payée pour rien, le contact attend la période suivante.

## Fonctionnement

- Le **worker IA** exécute `followUpLoop` : à chaque tour, `runFollowUpTick` (`lib/follow-ups.ts`) réserve **un** contact par un bail de 3 minutes (deux workers ne relancent jamais le même contact), rédige hors transaction, puis revérifie toutes les conditions sous verrou (projet, puis contact) avant de créer le message et sa tâche d’envoi. Le client a pu répondre entre-temps : la relance est alors abandonnée.
- **Rédaction par l’IA** (message de l’équipe vide) : la consigne habituelle « réponds au dernier message » est remplacée par une consigne de relance (`followUpInstruction`), avec l’historique de la conversation et la base de connaissances. Si une relance serait déplacée (refus, achat déjà fait, échange terminé), l’IA répond `[[SILENCE]]` : rien n’est envoyé et le contact n’est plus proposé avant un nouvel échange (`followUpDeclinedAt`).
- **Message de l’équipe** : envoyé tel quel, `{prénom}` remplacé par le prénom du client (retiré s’il est inconnu).
- Le message part comme une réponse de l’IA (expéditeur « BOT », source `follow_up`) par la file d’envoi normale. La tâche porte la version de l’IA et de l’agent : si un membre reprend la main avant l’envoi, elle est annulée.
- Échec de rédaction ou de mise en file : nouvel essai 15 minutes plus tard.
- Coût IA mesuré à part dans le back-office (« Relances automatiques », `ai_usage.feature = follow_up`) ; les relances n’entrent pas dans les temps de réponse de l’IA.

## Suivi

Sur la page Pipeline, à côté des réglages, pour les 30 derniers jours (`followUpStats`) :

- **Relances envoyées** (hors échecs) ;
- **Réponses obtenues** : relances suivies d’un message du client dans les 7 jours ;
- **Ventes après relance** : prospects passés à « Gagné » après au moins une relance, avec la valeur de ces affaires.

## Sécurité

- Lecture du résumé pour tous les membres qui voient le pipeline ; modification réservée aux propriétaires et administrateurs, revérifiée par l’action serveur (`app/actions/follow-ups.ts`), qui ne renvoie que des messages d’erreur sûrs.
- Requêtes SQL entièrement paramétrées. Le message de l’équipe est du texte brut (aucun HTML), limité à 500 caractères.
- Le prénom inséré ne garde que lettres, accents, apostrophes et traits d’union (`contactFirstName`).

## Mise en production

1. Appliquer la migration `202611090001_follow_ups` (`npm run db:deploy`).
2. Redémarrer le **worker IA** : c’est lui qui prépare les relances.
