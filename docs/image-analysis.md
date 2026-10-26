# Analyse des images reçues

Les nouveaux messages IMAGE des prospects sont mis en attente dès leur réception,
avec ou sans légende. Le worker `npm run worker:ai` utilise la même file persistante
que les audios, les mêmes protections de concurrence et les mêmes droits de facturation.
Le mode manuel n’empêche pas l’analyse ; l’envoi automatique reste soumis aux réglages IA.

## Modèle et activation

La clé `OPENROUTER_API_KEY` existante est réutilisée. Le modèle est choisi dans cet ordre :

1. `OPENROUTER_IMAGE_MODEL`, si renseigné (identifiant Gemini sur OpenRouter).
2. `OPENROUTER_MODEL`, si c’est un modèle `google/gemini-*`.
3. `google/gemini-2.5-flash-lite`.

Le modèle choisi doit accepter les images et les réponses JSON structurées.
Aucun second modèle n’est appelé. Les erreurs temporaires sont réessayées au maximum
trois fois, avec délai croissant ; les erreurs de configuration, crédit, authentification
ou refus explicite deviennent FAILED sans boucle de nouvelles tentatives.

Appliquer la migration `202610100001_message_extraction` si elle n’a pas encore été
déployée, régénérer Prisma, redéployer le site et redémarrer le worker IA.
Aucune migration supplémentaire n’est nécessaire si celle de l’audio est déjà appliquée.

## Résultat enregistré

Gemini retourne une description factuelle, le texte lisible dans sa langue d’origine
et les limites de lecture. Cette réponse est validée puis enregistrée dans
`message.extractedText`, avec modèle, version, statut et date. `message.content`
conserve la légende originale, qui accompagne l’extraction dans le contexte IA.
Le chat permet de consulter l’analyse et affiche les états en cours et indisponible.

Les suggestions, résumés, classifications Instinct et réponses automatiques utilisent
le résultat enregistré. Ils ne renvoient pas l’image au modèle à chaque demande.
Une image seule déclenche aussi un travail de réponse automatique si l’agent est actif.
Les aides IA attendent les extractions en cours ; l’Instinct est invalidé à leur fin.

Les images privées sont récupérées par identifiant Evolution ou dans le stockage privé,
validées (JPEG, PNG ou WebP, limite existante de 4 Mo), puis envoyées en base64.
Aucune URL fournie par le prospect n’est téléchargée directement et aucune URL publique
n’est créée. Les erreurs enregistrées ne contiennent ni image, ni texte du prospect,
ni clé API. Les textes visibles sont des données non fiables, jamais des instructions.

Les anciennes images ne sont pas analysées rétroactivement. Une image floue peut produire
une description signalant ses limites : COMPLETED signifie que l’extraction a abouti,
pas que tous les détails ont été lus. L’agent doit demander une précision si nécessaire.
Cette version ne réanalyse pas automatiquement une image pour une question ultérieure.
Comme pour l’audio, un arrêt entre la réponse fournisseur et l’écriture en base peut
entraîner une tentative refacturée lors de la reprise.

Contrat API : https://openrouter.ai/docs/guides/overview/multimodal/image-understanding
