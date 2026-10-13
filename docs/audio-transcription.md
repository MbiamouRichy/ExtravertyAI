# Transcription des vocaux reçus

Les nouveaux messages AUDIO de prospects sont mis en attente lors de leur ingestion.
Le worker existant `npm run worker:ai` récupère le média via Evolution (ou le stockage privé),
appelle `openai/whisper-large-v3-turbo`, puis `mistralai/voxtral-mini-3b-2507` uniquement
si le premier échoue ou renvoie une réponse inexploitable. Une erreur de clé ou de crédit
arrête le traitement sans appeler le second modèle.

## Mise en service

1. Appliquer les migrations avec `npm run db:deploy` dans l'environnement cible.
2. Régénérer Prisma avec `npx prisma generate` (également effectué par le build).
3. Redéployer le site et redémarrer le worker IA avec `OPENROUTER_API_KEY`,
   `OPENROUTER_MODEL`, `EVOLUTION_API_URL` et `EVOLUTION_API_KEY` configurés.
   Activer l'accès aux deux modèles STT dans OpenRouter.

Référence du contrat : https://openrouter.ai/docs/guides/overview/multimodal/stt

## Persistance et consommation

`message.extractedText` contient la transcription, indépendamment du contenu original.
`extractionStatus` distingue PENDING, PROCESSING, COMPLETED et FAILED ; null signifie
que le média n'a pas été planifié. Le modèle, la version et la date sont enregistrés.
Les images utilisent aussi ces champs avec Gemini : voir [l’analyse d’image](image-analysis.md).

Les réponses automatiques, suggestions, résumés et l'instinct lisent le texte enregistré.
La transcription fonctionne aussi en mode manuel ou en pause volontaire, à condition
que le projet dispose d'une période d'abonnement/essai valide. Les réponses automatiques
restent soumises aux réglages et quotas d'envoi existants.

Les anciens médias ne sont pas automatiquement retranscrits : pas de dépense rétroactive.
La limite média existante de 4 Mo reste applicable. Les formats audio déjà autorisés sont
conservés ; leur acceptation dépend des fournisseurs. Un échec est explicite, jamais remplacé
par une transcription inventée.

## Concurrence et reprise

La contrainte d'identité des messages empêche les doublons de webhook. Une réservation
atomique PostgreSQL et un jeton de bail coordonnent les workers. Une transcription terminée
n'est jamais relancée par une demande de résumé, de suggestion ou de classification.
L'instinct est invalidé à la fin d'une extraction pour inclure le nouveau contenu.

Maximum trois tentatives avec délai croissant ; un bail expiré est repris. Si le processus
meurt après la réponse du fournisseur mais avant l'enregistrement en base, une tentative
peut être refacturée : une garantie de facturation exactement une fois n'est pas possible
sans idempotence chez le fournisseur. Les erreurs enregistrées sont des codes sans contenu
du prospect ni secrets.
