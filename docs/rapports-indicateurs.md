# Rapport hebdomadaire : dictionnaire des indicateurs

> **Statut : proposition à valider (étape 1, point d’arrêt).** Aucun code de
> production n’est modifié. La page Rapports réelle et son aperçu actuel restent
> intacts. Le nouveau format se teste sur une page séparée, avec des données
> synthétiques : `/maquettes/projects/demo/reports-v2`.

Le rapport sert à décider, Analytics sert à explorer. En 30 secondes, un
propriétaire doit savoir : ce qui a réellement changé, où l’IA a échoué ou passé
la main, et quelle action mener en premier.

---

## 0. Point de départ : les données brutes

### Source utilisée

- Base de `.env` (localhost) : arrêtée. Base locale de test (port 55432) :
  1 projet, 6 messages, inexploitable.
- Base distante `db-preview` (`.env.vercel-preview`) : **non consultée**. Je ne
  m’y connecte pas sans votre accord explicite, même pour des agrégats.
- **Conséquence : tous les chiffres de ce document viennent d’un jeu
  synthétique** (`components/maquettes/reports-v2/data.ts`, graine fixe) : projets
  de 10 à 50 conversations par semaine, une semaine creuse, une semaine de
  diffusion, un changement de consignes, une panne WhatsApp et une semaine où un
  nouveau sujet dépasse les connaissances de l’IA. Les 30 conversations à lire
  n’ont pas pu l’être.
- Dans ce jeu, **26 % des semaines ont moins de 20 conversations**. À mesurer sur
  la préproduction avant de figer les seuils (requête fournie en § 9).

### Événements bruts recensés

| Table | Champs utiles | Ce que l’événement dit |
| --- | --- | --- |
| `message` | `senderType`, `fromMe`, `status`, `aiSkip`, `source`, `agentId`, `createdAt` | Qui a écrit, si l’envoi a abouti, si l’IA s’est volontairement tue |
| `ai_job` | `state`, `errorCode`, `messageId` | Si une réponse IA a été générée ou a échoué |
| `outbound_job` | `finishedAt`, `messageId`, `requestId` | Heure réelle d’acceptation par WhatsApp |
| `contact_event` | `AI_PAUSED`, `AI_PAUSED_BY_REPLY`, `AI_PAUSED_FROM_PHONE`, `AI_QUIET`, `STAGE_CHANGED`, `BROADCAST_OPT_OUT`… | Reprises humaines et changements d’état |
| `knowledge_gap` | `question`, `status`, `createdAt`, `resolvedAt` | L’IA a répondu en signalant une information manquante |
| `ai_feedback` | `rating`, `correction`, `createdAt` | Jugement de l’équipe sur une réponse IA |
| `csat_survey` | `sentAt`, `score`, `respondedAt`, `expiresAt` | Note du client |
| `settings_audit` | `action = 'agent.updated'` | Changement de consignes |
| `contact` | `resolvedAt`, `assigneeId`, `aiActive`, `pipelineStage`, `dealValue` | **État courant** seulement, pas d’historique |
| `broadcast_recipient` | `messageId`, `queuedAt` | Messages issus d’une diffusion |

### Huit constats du code qui changent les définitions

1. **Les diffusions ressemblent à des messages d’équipe** : `senderType = 'AGENT'`,
   `source = 'broadcast'`. Sans exclusion explicite, une diffusion compte comme
   une intervention humaine. C’est déjà le cas dans Analytics (`aiAutonomy` =
   BOT / (BOT + AGENT)) et dans `sent` du rapport actuel.
2. **STOP / START ne laissent aucune trace exploitable** : ni `ai_job`, ni `aiSkip`.
   Ils ressemblent à une demande restée sans réponse. Les réponses au
   questionnaire, elles, se reconnaissent par `csat_survey.responseMessageId`.
3. **L’IA ne déclenche jamais de passage à l’humain.** `agentHumanHandover`
   l’invite seulement à orienter le client vers un conseiller, sans événement.
   Les reprises connues sont humaines, et leur « motif » est le **canal** :
   pause manuelle, réponse depuis l’application, réponse depuis le téléphone.
   La raison métier n’est enregistrée nulle part.
4. **`knowledge_gap` est le seul signal « l’IA ne savait pas »** : créé quand l’IA
   répond avec le drapeau `missing`. Une réponse fausse mais assurée n’en crée pas.
5. **Toutes les annulations d’`ai_job` ne se valent pas** : `AI_MERGED` et
   `AI_STATE_CHANGED` sont normales ; `QUOTA_EXCEEDED`, `PERIOD_UNAVAILABLE`,
   `AI_HTTP_40x` signifient que l’IA n’a pas répondu.
6. **Supprimer un contact supprime en cascade** ses messages, événements et
   questions. Un recalcul a posteriori diffère donc de l’instantané figé : c’est
   attendu, et le script de rapprochement devra le signaler.
7. **`ai_job` n’a pas d’index `(projectId, createdAt)`** : on y accède par
   `message` (index `[projectId, createdAt]`) puis `ai_job.messageId` (unique).
8. **Aucun lien profond n’existe vers une vue filtrée** : les filtres de la
   messagerie (`manual`, `unassigned`…) et les onglets de la base de
   connaissances (`improve`, `agent`) sont des états locaux. Les boutons d’action
   supposent d’ajouter `?filter=` et `?tab=` (petit changement, étape 3).

### Ce que les données ne permettent pas de savoir

- L’historique des **déconnexions WhatsApp** (`instanceStatus` est l’état
  courant) : on n’en voit que les effets (envois en échec).
- La **raison** d’une reprise par l’équipe, ni si l’IA a orienté le client vers
  un humain.
- Si une réponse de l’IA était **juste** : seuls les votes de l’équipe et le
  questionnaire en donnent un aperçu partiel.
- L’**état passé** d’une conversation : `aiActive`, `resolvedAt`, `assigneeId` et
  le statut des questions ne gardent que leur dernière valeur.
- Les **horaires d’ouverture** de l’équipe : les délais incluent nuits et week-ends.
- Le **fuseau du projet** : il n’existe pas en base (seul celui de l’utilisateur
  est connu, par cookie).
- La **contribution de l’IA aux ventes** : `dealValue` est saisi à la main, sans
  attribution.
- L’ouverture des e-mails (hors périmètre).

---

## 1. Arbre d’indicateurs

**Résultat principal proposé — autonomie de l’IA** : part des conversations de
la semaine que l’IA a menées seule, **sans reprise humaine, sans question restée
sans réponse et sans échec technique**.

> Écart avec votre formulation (« sans intervention humaine ni échec ») : je
> compte aussi comme non autonome une conversation où l’IA a signalé une
> information manquante. Sinon, une IA qui répond « je ne sais pas, contactez un
> conseiller » serait autonome. **À valider.**

Chaque conversation est classée **une seule fois**, dans la première issue qui
la concerne. Les cinq issues s’additionnent donc exactement au total :

```
Conversations ayant demandé une réponse (n)
├── 1. Échec technique ............ → Échecs techniques
├── 2. Reprise par l’équipe ....... → Reprises (motif = canal)
├── 3. Question sans réponse ...... → Questions sans réponse (thèmes)
├── 4. Restée sans aucune réponse . → En attente à la clôture
└── 5. Menée seule par l’IA ....... = Autonomie
        └── qualité : Satisfaction, votes de l’équipe ; rapidité : Première réponse
```

### Candidats évalués

| Candidat | Décision | Raison |
| --- | --- | --- |
| Taux d’autonomie IA | **Retenu** (résultat) | Répond à « la semaine a-t-elle été bonne ? » |
| Reprises par motif | **Retenu** | Levier direct ; motif = canal, faute de mieux |
| Délai de première réponse (médiane, p90 ; IA et équipe) | **Retenu** (IA en tête, équipe en second) | L’équipe dépasse rarement 10 réponses/semaine : comparée seulement au-delà |
| Questions sans réponse | **Retenu** | Cause la plus actionnable d’une baisse d’autonomie |
| Satisfaction (CSAT, taux de réponse) | **Retenu** | Seule voix du client ; votes `ai_feedback` en constat, pas en tuile |
| Fiabilité (envois et `ai_job` en échec) | **Retenu** | Détecte les pannes |
| En attente en fin de semaine | **Constat et détail, pas une tuile** | C’est un stock à traiter, pas une tendance |
| 8 compteurs actuels | **Conservés** dans « Compteurs d’activité » | Lisibles dans chaque rapport, en écart absolu |

---

## 2. Fiches

### Définition commune : « conversation ayant demandé une réponse »

Un contact compte pour la semaine s’il a envoyé au moins un message client
(`senderType = 'CLIENT' AND NOT fromMe`) entre le lundi 00:00 et le lundi suivant
00:00 UTC, en excluant :

- `aiSkip` = `QUIET_ACK` (simple « merci »), `SILENCE`, `REPEATED` ;
  `MERGED` reste inclus (le message est regroupé, pas ignoré) ;
- les réponses au questionnaire (`csat_survey.responseMessageId`) ;
- STOP / START : **à exclure par une nouvelle valeur `aiSkip = 'KEYWORD'`** posée
  à l’ingestion (les semaines antérieures restent légèrement surestimées les
  semaines de diffusion).

Les diffusions (`source = 'broadcast'`) ne sont jamais une réponse ni une
reprise. Les contacts supprimés disparaissent du calcul (cascade).

```sql
-- $1 = projectId, $2 = lundi 00:00 UTC, $3 = lundi suivant 00:00 UTC (exclu)
WITH semaine AS (
  SELECT m.id, m."contactId", m."createdAt", m."senderType", m."fromMe",
         m.status, m.source, m."aiSkip"
  FROM message m
  WHERE m."projectId" = $1 AND m."createdAt" >= $2 AND m."createdAt" < $3
),
demandes AS (
  SELECT s.* FROM semaine s
  WHERE s."senderType" = 'CLIENT' AND NOT s."fromMe"
    AND (s."aiSkip" IS NULL OR s."aiSkip" = 'MERGED')
    AND NOT EXISTS (SELECT 1 FROM csat_survey q WHERE q."responseMessageId" = s.id)
),
conversations AS (
  SELECT "contactId", min("createdAt") AS premiere_demande
  FROM demandes GROUP BY "contactId"
)
```

### 2.1 Autonomie de l’IA (résultat principal)

- **Question** : quelle part des conversations l’IA a-t-elle menées seule, sans échec ?
- **Numérateur** : conversations classées « autonome » (aucune des 4 premières
  issues, et au moins une réponse IA envoyée après la première demande).
- **Dénominateur** : conversations ayant demandé une réponse.
- **Rattachement** : semaine du premier message client de la semaine.
- **Sens souhaitable** : hausse. **Seuil** : 20 conversations.
- **Affichage** : taux, n, intervalle de Wilson à 95 %.

```sql
, par_contact AS (
  SELECT s."contactId",
    bool_or(s."fromMe" AND s.status = 'FAILED'
            AND s.source IS DISTINCT FROM 'broadcast') AS envoi_echoue,
    bool_or(s."senderType" = 'AGENT'
            AND s.source IS DISTINCT FROM 'broadcast') AS message_equipe,
    max(s."createdAt") FILTER (WHERE s."senderType" = 'BOT'
            AND s.status IN ('SENT', 'DELIVERED', 'READ')) AS derniere_reponse_ia
  FROM semaine s GROUP BY s."contactId"
),
generation_echouee AS (
  SELECT DISTINCT d."contactId" FROM demandes d
  JOIN ai_job j ON j."messageId" = d.id
  WHERE j.state = 'FAILED'
     OR (j.state = 'CANCELLED' AND j."errorCode" NOT IN ('AI_MERGED', 'AI_STATE_CHANGED'))
),
reprises AS (
  SELECT DISTINCT e."contactId" FROM contact_event e
  WHERE e."projectId" = $1 AND e."createdAt" >= $2 AND e."createdAt" < $3
    AND e.type IN ('AI_PAUSED', 'AI_PAUSED_BY_REPLY', 'AI_PAUSED_FROM_PHONE')
),
questions AS (
  SELECT DISTINCT g."contactId" FROM knowledge_gap g
  WHERE g."projectId" = $1 AND g."createdAt" >= $2 AND g."createdAt" < $3
),
issues AS (
  SELECT c."contactId",
    CASE
      WHEN p.envoi_echoue OR ge."contactId" IS NOT NULL THEN 'echec'
      WHEN p.message_equipe OR r."contactId" IS NOT NULL THEN 'reprise'
      WHEN q."contactId" IS NOT NULL THEN 'question'
      WHEN p.derniere_reponse_ia IS NULL
        OR p.derniere_reponse_ia < c.premiere_demande THEN 'sans_reponse'
      ELSE 'autonome'
    END AS issue
  FROM conversations c
  JOIN par_contact p USING ("contactId")
  LEFT JOIN generation_echouee ge USING ("contactId")
  LEFT JOIN reprises r USING ("contactId")
  LEFT JOIN questions q USING ("contactId")
)
SELECT count(*)                                       AS conversations,
       count(*) FILTER (WHERE issue = 'autonome')     AS autonomes,
       count(*) FILTER (WHERE issue = 'reprise')      AS reprises,
       count(*) FILTER (WHERE issue = 'question')     AS questions,
       count(*) FILTER (WHERE issue = 'sans_reponse') AS sans_reponse,
       count(*) FILTER (WHERE issue = 'echec')        AS echecs
FROM issues;
```

- **Cas limites** : conversation à cheval sur deux semaines (comptée dans
  chacune où le client écrit) ; IA déjà en pause avant la semaine (message
  d’équipe → reprise, sinon sans réponse) ; projet en pause ou quota épuisé
  (`ai_job` annulé → échec) ; message client du dimanche 23:58 non encore traité
  (sans réponse : le calcul s’arrête à la clôture).
- **Ne prouve pas** : que les réponses étaient justes, ni que le client est
  satisfait. Une conversation de 2 messages pèse autant qu’une de 30.
- **Écart avec Analytics** : Analytics mesure une part de **messages**
  (BOT / BOT + AGENT, diffusions comprises) sur une fenêtre glissante en fuseau
  local. Les deux chiffres ne concorderont pas ; c’est voulu et sera documenté
  dans la preuve de rapprochement.

### 2.2 Reprises par l’équipe

- **Question** : quelle part des conversations un humain a-t-il dû reprendre ?
- **Numérateur** : conversations classées « reprise ». **Dénominateur** : n.
- **Motif** (premier événement de la semaine) : réponse depuis l’application
  (`AI_PAUSED_BY_REPLY`), depuis le téléphone (`AI_PAUSED_FROM_PHONE`), pause
  manuelle (`AI_PAUSED`), IA déjà en pause (message d’équipe sans événement).
- **Sens** : baisse, avec prudence. **Seuil** : 20 conversations.

```sql
SELECT coalesce(premier.type::text, 'IA_DEJA_EN_PAUSE') AS motif, count(*)
FROM issues i
LEFT JOIN LATERAL (
  SELECT e.type FROM contact_event e
  WHERE e."projectId" = $1 AND e."contactId" = i."contactId"
    AND e."createdAt" >= $2 AND e."createdAt" < $3
    AND e.type IN ('AI_PAUSED', 'AI_PAUSED_BY_REPLY', 'AI_PAUSED_FROM_PHONE')
  ORDER BY e."createdAt" LIMIT 1
) premier ON true
WHERE i.issue = 'reprise'
GROUP BY 1;
```

- **Cas limites** : une reprise suivie d’un échec compte en échec (priorité) ;
  une note interne n’est pas une reprise (table séparée).
- **Ne prouve pas** : un problème. Une reprise peut être voulue (vente,
  réclamation, client connu).

### 2.3 Questions sans réponse

- **Question** : combien de questions l’IA n’a-t-elle pas su traiter ?
- **Valeur** : questions créées dans la semaine. **Complément** : questions
  encore ouvertes à la clôture (créées avant la fin, non résolues ou résolues
  après la fin).
- **Sens** : baisse. **Seuil** : 5 questions (en dessous, « 1 → 3 », sans %).
- **Thèmes** (détail, dans l’application uniquement) : regroupement
  déterministe à définir — proposition : rattacher chaque question à l’entrée
  de connaissances la plus proche par la recherche plein texte existante, sinon
  au mot significatif le plus fréquent. **À valider.**

```sql
SELECT count(*) FILTER (WHERE g."createdAt" >= $2) AS nouvelles,
       count(*) FILTER (WHERE g."resolvedAt" IS NULL
                           OR g."resolvedAt" >= $3) AS ouvertes_cloture
FROM knowledge_gap g
WHERE g."projectId" = $1 AND g."createdAt" < $3
  AND (g."createdAt" >= $2 OR g."resolvedAt" IS NULL OR g."resolvedAt" >= $3);
```

- **Cas limites** : `ANSWERED` et `DISMISSED` renseignent tous deux `resolvedAt`
  (vérifié dans `lib/ai-feedback.ts`) ; une question sans contact (`contactId`
  nul) compte dans le total mais pas dans les issues de conversation.
- **Ne prouve pas** : l’absence de mauvaises réponses. Les questions mal
  comprises que l’IA n’a pas signalées n’y figurent pas.

### 2.4 Première réponse

- **Question** : combien de temps un client attend-il sa première réponse ?
- **Mesure** : par conversation, de la première demande de la semaine à la
  première réponse envoyée (heure d’acceptation `outbound_job.finishedAt`, à
  défaut `message.createdAt` pour les réponses depuis le téléphone). Médiane et
  p90 (« 9 clients sur 10 servis en moins de… »), **IA et équipe séparées**.
- **Sens** : baisse. **Seuil** : 10 réponses pour la médiane.

```sql
, premieres_reponses AS (
  SELECT DISTINCT ON (c."contactId") c."contactId", c.premiere_demande,
         r."senderType", COALESCE(o."finishedAt", r."createdAt") AS repondu_a
  FROM conversations c
  JOIN message r ON r."projectId" = $1 AND r."contactId" = c."contactId"
       AND r."createdAt" > c.premiere_demande AND r."createdAt" < $3
       AND r."fromMe" AND r.status IN ('SENT', 'DELIVERED', 'READ')
       AND r.source IS DISTINCT FROM 'broadcast'
  LEFT JOIN outbound_job o ON o."messageId" = r.id
  ORDER BY c."contactId", r."createdAt", r.id
)
SELECT "senderType", count(*) AS n,
  percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM repondu_a - premiere_demande)) AS mediane_s,
  percentile_cont(0.9) WITHIN GROUP (ORDER BY extract(epoch FROM repondu_a - premiere_demande)) AS p90_s
FROM premieres_reponses GROUP BY "senderType";
```

- **Cas limites** : conversation sans réponse avant la clôture (exclue du délai,
  comptée en « en attente ») ; regroupement `MERGED` (le délai part du premier
  message, ce que vit le client).
- **Ne prouve pas** : la réactivité de l’équipe aux heures ouvrées (inconnues).
- **Écart avec Analytics** : Analytics mesure chaque réponse IA (`ai_job` →
  `outbound_job`) sur 8 jours glissants, pas la première réponse par conversation.

### 2.5 Satisfaction client

- **Question** : comment les clients notent-ils l’échange ?
- **Valeur** : moyenne des notes 1 à 5 reçues **avant la clôture**, pour les
  questionnaires **envoyés dans la semaine** (cohorte par `sentAt`).
  **Complément** : taux de réponse avec intervalle de Wilson, notes ≤ 2.
- **Sens** : hausse. **Seuil** : 10 réponses.

```sql
SELECT count(*) AS envoyes,
       count(*) FILTER (WHERE "respondedAt" < $3) AS reponses,
       avg(score) FILTER (WHERE "respondedAt" < $3) AS moyenne,
       count(*) FILTER (WHERE "respondedAt" < $3 AND score <= 2) AS notes_basses
FROM csat_survey
WHERE "projectId" = $1 AND "sentAt" >= $2 AND "sentAt" < $3;
```

- **Cas limites** : questionnaire du dimanche soir (moins de temps pour répondre :
  biais constant d’une semaine à l’autre) ; questionnaire désactivé (non mesuré,
  jamais 0).
- **Ne prouve pas** : l’avis des clients qui ne répondent pas.
- **Écart avec Analytics** : même cohorte par `sentAt`, mais Analytics compte
  aussi les réponses arrivées après la clôture.
- **Votes de l’équipe** (`ai_feedback`, par date de vote) : alimentent un
  constat (≥ 3 votes négatifs et ≥ 50 % des votes), pas une tuile.

### 2.6 Échecs techniques

- **Question** : combien d’envois ou de réponses IA ont échoué ?
- **Valeur** : messages sortants `FAILED` + générations IA en échec (définition
  du constat 5 ci-dessus). **Complément** : part sur les envois, dont diffusions.
- **Sens** : baisse. **Seuil** : 5 (en dessous, écart absolu).

```sql
SELECT count(*) FILTER (WHERE "fromMe" AND status IN ('SENT', 'DELIVERED', 'READ', 'FAILED')) AS envois,
       count(*) FILTER (WHERE "fromMe" AND status = 'FAILED') AS envois_echoues,
       count(*) FILTER (WHERE "fromMe" AND status = 'FAILED' AND source = 'broadcast') AS dont_diffusions
FROM message
WHERE "projectId" = $1 AND "createdAt" >= $2 AND "createdAt" < $3;

SELECT count(*) AS generations_echouees
FROM message m JOIN ai_job j ON j."messageId" = m.id
WHERE m."projectId" = $1 AND m."createdAt" >= $2 AND m."createdAt" < $3
  AND (j.state = 'FAILED'
       OR (j.state = 'CANCELLED' AND j."errorCode" NOT IN ('AI_MERGED', 'AI_STATE_CHANGED')));
```

- **Cas limites** : un message encore `PENDING` au calcul n’est ni réussi ni en
  échec (à afficher à part s’il dépasse quelques unités).
- **Ne prouve pas** : la cause (déconnexion, numéro bloqué, quota).

### 2.7 En attente à la clôture (constat et détail)

- **Question** : qui attend encore une réponse dimanche à minuit ?
- **Valeur** : contacts dont le dernier message utile des 14 derniers jours est
  un message client reçu plus d’une heure avant la clôture, sans conversation
  marquée « traitée » avant la clôture. **Détail** : plus de 24 h, mode manuel.

```sql
WITH derniers AS (
  SELECT DISTINCT ON (m."contactId") m.id, m."contactId", m."senderType",
         m."fromMe", m."createdAt"
  FROM message m
  WHERE m."projectId" = $1
    AND m."createdAt" >= $3 - interval '14 days' AND m."createdAt" < $3
    AND m.source IS DISTINCT FROM 'broadcast'
    AND (m."senderType" <> 'CLIENT' OR m."aiSkip" IS NULL OR m."aiSkip" = 'MERGED')
    AND NOT EXISTS (SELECT 1 FROM csat_survey q WHERE q."responseMessageId" = m.id)
  ORDER BY m."contactId", m."createdAt" DESC, m.id DESC
)
SELECT count(*) AS en_attente,
       count(*) FILTER (WHERE d."createdAt" < $3 - interval '24 hours') AS plus_de_24h,
       count(*) FILTER (WHERE NOT c."aiActive") AS mode_manuel
FROM derniers d
JOIN contact c ON c.id = d."contactId" AND c."projectId" = $1
WHERE d."senderType" = 'CLIENT' AND NOT d."fromMe"
  AND d."createdAt" < $3 - interval '1 hour'
  AND (c."resolvedAt" IS NULL OR c."resolvedAt" >= $3);
```

- **Limite** : `aiActive` et `resolvedAt` sont lus au moment du calcul (lundi
  matin), pas à la clôture ; l’écart est de quelques heures.

### 2.8 Repères (annotations)

- Consignes modifiées : `settings_audit.action = 'agent.updated'` dans la semaine.
- Diffusion : messages `source = 'broadcast'` créés dans la semaine (et nombre de
  destinataires via `broadcast_recipient.messageId`).
- Affichés en traits pointillés sur les courbes et cités dans les constats
  concernés (« l’écart peut aussi venir du changement de consignes »).

---

## 3. Signal ou bruit

- **Habitude** : médiane des 8 semaines précédentes. Pour un taux, un délai ou
  une note, seules les semaines au-dessus du seuil d’effectif comptent ; un
  compteur garde toutes ses semaines (0 échec est une habitude).
- **Plage normale** : médiane ± k · σ, avec σ = max(1,4826 × MAD ; bruit
  d’échantillonnage de la semaine). Bruit : √(p(1−p)/n) pour un taux, √médiane
  pour un compteur (Poisson), 1,25 × médiane / √n pour un délai, 1/√n pour une note.
- **« Inhabituel »** seulement hors plage **et** au-dessus du seuil d’effectif.
  Sous le seuil : écart absolu (« 0 → 2 »), jamais de pourcentage.
- Moins de 4 semaines comparables : « historique insuffisant ».
- Pour un taux : n et intervalle de Wilson à 95 % toujours affichés.

### Rétro-test sur le jeu synthétique (400 projets × 12 semaines)

| k | Semaines calmes avec ≥ 1 fausse alerte | Panne WhatsApp détectée | Incident « questions » détecté (questions ou autonomie) |
| --- | --- | --- | --- |
| 2 | 10,6 % | 100 % | 79 % / 47 % |
| 2,5 | 4,8 % | 100 % | 68 % / 35 % |
| **3 (proposé)** | **2,2 %** (≈ 1 fausse alerte par projet tous les 11 mois) | **100 %** | **56 % / 26 %** |

Détection de l’incident « questions » par taille, k = 3 : 29 % (10–19
conversations/semaine), 56 % (20–34), 79 % (35–50).

**Lecture honnête** : avec 40 conversations par semaine, seule une chute
d’autonomie d’environ 25 points est détectable de façon fiable. Les petits
projets verront surtout des constats « à traiter » (questions ouvertes, clients
en attente), qui ne dépendent pas de la statistique. Ces taux valident le code
et la méthode sur un modèle ; **ils ne valent pas mesure réelle** tant que le
rétro-test n’a pas tourné sur la préproduction.

---

## 4. Constats et verdict (règles déterministes)

Score = conversations concernées × confiance (signal net 1 ; à traiter 0,6) ;
3 constats au plus. Aucun texte rédigé par un modèle de langage.

| Constat | Déclencheur | Confiance | Action et lien |
| --- | --- | --- | --- |
| Questions sans réponse | hors plage, ou ≥ 5 ouvertes à la clôture | net / à traiter | Répondre aux questions → `knowledge?tab=improve` |
| Clients en attente | ≥ 1 à la clôture | net si > 24 h | Voir les conversations → `chat?filter=manual` |
| Échecs techniques | hors plage, ou ≥ 3 | net / à traiter | Vérifier la connexion WhatsApp → `settings` |
| Reprises | hors plage (hausse) | net | Relire les reprises → `chat?filter=manual` |
| Satisfaction | hors plage (baisse), ou ≥ 3 notes ≤ 2 | net / à traiter | Lire les avis → `analytics` |
| Votes négatifs | ≥ 3 et ≥ 50 % des votes | à traiter | Corriger ces réponses → `knowledge?tab=improve` |
| Première réponse IA | hors plage (hausse) | net | Voir le détail des délais → `analytics` |
| Autonomie | hors plage (baisse) **sans** levier net qui l’explique | à traiter | Relire des conversations → `chat` |

**Verdict** : semaine vide → « Semaine sans activité » ; moins de 4 semaines →
« Historique insuffisant » ; au moins un indicateur hors plage défavorable →
« À surveiller » (les deux premiers cités, et l’autonomie toujours rappelée) ;
sinon un favorable → « Bonne semaine » ; sinon « Dans vos habitudes » (ou
« Semaine calme » sous le seuil).

---

## 5. Instantané versionné (proposition pour l’étape 2)

- `ReportSnapshotSchema` devient une union discriminée par `version`. Un
  instantané sans champ `version` est lu comme `1` (prétraitement). Dans la v1,
  `csatResponses` devient optionnel : absent = « non mesuré à l’époque », plus
  jamais `0` (correction du `.default(0)`).
- La v2 stocke, pour chaque indicateur : valeur, n, statut, plage (médiane,
  bornes, semaines utilisées) **et la série des 12 semaines calculée au moment du
  rapport**. Conséquences : la page et l’e-mail lisent la même source ; la plage
  existe dès le premier rapport v2 (recalculée sur les données brutes) ; un vieux
  rapport garde ses chiffres d’origine.
- Les 8 compteurs actuels restent dans la v2 (`legacy`).
- Requête : une passe par semaine sur `message` (index `[projectId, createdAt]`),
  dans la transaction RepeatableRead existante, sans boucle par contact.
  EXPLAIN ANALYZE sur 100 000 messages : à faire à l’étape 2.

## 6. Fuseau horaire

Les fenêtres sont en UTC (lundi 00:00 → lundi 00:00). Pour un client en UTC+1
(Cameroun, Gabon, sans heure d’été), la semaine affichée va du **lundi 01:00 au
lundi suivant 01:00 heure locale** : la première heure du lundi est rangée dans
la semaine précédente. L’effet est faible (1 heure sur 168, peu d’activité à
minuit) mais visible sur un message de 00:30. Le rapport part à
`reportsHourUtc` (08:00 UTC = 09:00 à Douala).

**Proposition, non implémentée** : ajouter `project.timeZone` (IANA, par défaut
celui du propriétaire à la création) et calculer les bornes à minuit local.
J’attends votre accord.

---

## 7. Exemple de rapport rédigé (semaine synthétique S42, 12 → 18 oct. 2026)

> **À surveiller.** Semaine à surveiller : l’IA n’a mené seule que 45 % des
> conversations, contre 70 % d’habitude, et 14 questions sont restées sans
> réponse, contre 3 d’habitude.
>
> **1. 14 questions sont restées sans réponse de l’IA, bien plus que d’habitude**
> (signal net, ≈ 14 conversations). Habitude : 3 sur 8 semaines, plage normale
> 0 à 7. 19 questions ouvertes à la clôture ; sujet le plus fréquent :
> livraison (10). → *Répondre aux questions.*
>
> Indicateurs :
> - Autonomie de l’IA **45 %** — 18 sur 40 (IC 95 % 31–60 %). Inhabituel.
>   Habitude 70 %, plage normale 48–92 %.
> - Reprises par l’équipe **20 %** — 8 sur 40. Dans l’habitude (16 %).
> - Questions sans réponse **14** — Inhabituel. Habitude 3, plage 0 à 7.
> - Première réponse de l’IA **33 s** — 9 sur 10 en moins de 2 min.
>   Dans l’habitude. Équipe : médiane 33 min sur 8 réponses (trop peu pour comparer).
> - Satisfaction **4,4/5** — 12 réponses sur 32 questionnaires. Dans l’habitude.
> - Échecs techniques **2** — effectif faible : 0 → 2 par rapport à la semaine
>   précédente.
>
> Où l’IA a passé la main : 18 menées seules, 8 reprises, 12 questions sans
> réponse, 2 échecs, 0 restée sans réponse.

---

## 8. Décisions à valider avant l’étape 2

1. **Définition de l’autonomie** : les conversations avec question sans réponse
   sont-elles non autonomes ? (proposé : oui)
2. **k = 3** (2,2 % de fausses alertes, détection plus lente) ou **k = 2,5**
   (4,8 %, détection meilleure) ?
3. **Seuils** : 20 conversations, 10 réponses, 5 événements — à confirmer après
   mesure sur la préproduction.
4. **Thèmes des questions** : regroupement par entrée de connaissances la plus
   proche (proposé) ; les questions complètes restent dans l’onglet
   « À améliorer », jamais dans l’e-mail ni dans le rapport.
5. **Nouvelle valeur `aiSkip = 'KEYWORD'`** pour STOP / START (migration).
6. **Liens profonds** `chat?filter=` et `knowledge?tab=` à ajouter.
7. **Fuseau du projet** : ajout de `project.timeZone` (proposé, non implémenté).
8. **Accès à `db-preview`** pour mesurer les distributions réelles avec des
   requêtes agrégées uniquement : oui ou non ?

## 9. Mesure à lancer sur la préproduction (agrégats seulement)

```sql
-- Conversations ayant demandé une réponse, par projet et par semaine, 12 semaines.
SELECT m."projectId", date_trunc('week', m."createdAt") AS semaine,
       count(DISTINCT m."contactId") AS conversations
FROM message m
WHERE m."createdAt" >= date_trunc('week', now()) - interval '12 weeks'
  AND m."createdAt" < date_trunc('week', now())
  AND m."senderType" = 'CLIENT' AND NOT m."fromMe"
  AND (m."aiSkip" IS NULL OR m."aiSkip" = 'MERGED')
GROUP BY 1, 2;
-- Puis : part des lignes avec conversations < 20, médiane et p90 par projet.
```

`date_trunc('week', …)` tronque au lundi, comme `reportWindow`.
