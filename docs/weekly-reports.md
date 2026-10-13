# Rapports hebdomadaires Business

La page `/projects/[projectId]/reports` est réservée aux membres OWNER et ADMIN. Les autres plans affichent une présentation de l’offre. Les réglages et l’envoi nécessitent un accès Business valide selon les périodes de facturation existantes, y compris un essai valide. Une pause de l’automatisation ne suspend pas le reporting.

## Déploiement

1. Appliquer les migrations avec `npm run db:deploy`, puis générer le client et construire l’application.
2. Configurer `DATABASE_URL`, `RESEND_API_KEY`, `NEXT_PUBLIC_APP_URL` (origine HTTPS) et, facultativement, `REPORTS_EMAIL_FROM` (expéditeur vérifié chez Resend). L’expéditeur utilise sinon `BILLING_EMAIL_FROM`, puis l’adresse de notification habituelle.
3. Démarrer le service permanent `npm run worker:reports`, ou `docker compose up -d --build reports-worker` avec le fichier d’environnement de production configuré.
4. Vérifier la première génération et les états d’envoi dans la page Rapports. Aucun envoi réel n’est effectué par les tests.

## Programmation et données

Activé par défaut sur les projets Business éligibles. Lundi 08:00 UTC par défaut, heure réglable de 00 à 23 UTC. Périodes lundi 00:00 inclus à lundi suivant 00:00 exclu, comparées à la semaine précédente. Pas de changement saisonnier. Le premier rapport couvre la dernière semaine complète ; les projets créés pendant la semaine courante attendent la suivante. Un projet récent est signalé comme partiel.

Le worker rattrape seulement la dernière semaine terminée après une interruption. Il ne produit pas de rafale de rapports historiques. Les projets inéligibles sont réévalués chaque jour ; un changement des réglages déclenche une réévaluation au prochain passage. Les changements d’heure ou réactivations ne renvoient pas un rapport déjà généré. Les réglages des conseils concernent les futurs rapports ; les instantanés existants restent figés.

Les mesures utilisent uniquement les messages et contacts du projet, plus les événements `agent.updated`. Aucun contenu de conversation, nom de client ou numéro de téléphone n’entre dans l’instantané ni l’e-mail. Les statuts sont ceux observés au calcul et peuvent différer d’Analytics après des accusés tardifs. Les modifications comptées correspondent à des enregistrements de configuration, pas à des gains prouvés. Les conseils sont déterministes, sans appel IA.

## Livraison et exploitation

Un instantané unique par projet et semaine, et une entrée d’outbox unique par rapport et destinataire. Les destinataires sont les OWNER/ADMIN avec une adresse vérifiée lors de la génération ; leurs droits, adresse, abonnement et activation sont recontrôlés au moment de la prise en charge. Chaque e-mail est individuel. Un changement de membre n’ajoute pas rétroactivement un destinataire à un rapport existant. Un envoi déjà en cours chez le prestataire ne peut pas être rappelé.

Verrous transactionnels et `SKIP LOCKED` coordonnent les workers. Les corps d’e-mail restent immuables et les tentatives partagent la même clé Resend. Backoff exponentiel jusqu’à une heure, bail de deux minutes pour reprendre après un crash. Après 23 heures depuis la première tentative, une livraison incertaine passe en `REVIEW_REQUIRED`, afin de ne pas dépasser la fenêtre de déduplication de 24 heures du prestataire. Ne pas réinitialiser aveuglément cet état : vérifier chez Resend via la clé `weekly-report/<id>` avant toute intervention. Les messages sans tentative devenus trop anciens sont annulés.

`SENT` signifie accepté par Resend, pas délivré ni ouvert. Surveiller les logs `[reports-worker]`, les états `REVIEW_REQUIRED` et l’absence de rapports après le créneau attendu. L’application n’affirme pas que le worker est en bonne santé à partir de la seule programmation.

L’interface affiche les 12 derniers rapports générés ; les liens directs vers les anciens rapports restent protégés par l’appartenance au projet et le plan Business. Les rapports et leurs e-mails sont supprimés en cascade avec le projet. Aucune politique de purge automatique supplémentaire n’est imposée.
