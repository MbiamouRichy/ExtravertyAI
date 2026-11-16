# IA de secours et budget de jetons

## Modèle de secours

Toutes les complétions passent par [`lib/openrouter.ts`](../lib/openrouter.ts) :

- les réponses aux clients, le bac à sable et les relances ;
- le résumé de conversation, l’aide à la rédaction et l’aide au message système ;
- l’analyse des images.

La transcription audio a sa propre bascule (Whisper, puis Voxtral). Instinct utilise ses modèles de décision.

| Variable | Rôle |
|---|---|
| `OPENROUTER_MODEL` | Modèle principal, `google/gemini-2.5-flash-lite` |
| `OPENROUTER_FALLBACK_MODEL` | Secours facultatif, `openai/gpt-6-luna` recommandé. Vide, invalide ou identique au principal : pas de secours |

`OPENROUTER_API_KEY` sert aux deux modèles. Elle n’est lue que côté serveur : worker IA et actions serveur. Ne jamais l’exposer sous un nom `NEXT_PUBLIC_*`.

### Quand la bascule a lieu

Le secours ne répond que si le principal est **indisponible** :

- délai dépassé (15 s pour une réponse au client) ou erreur réseau ;
- statuts HTTP 408, 429, 500, 502, 503 ou 504 ;
- génération interrompue par le fournisseur (`finish_reason: "error"`).

Le secours n’est **jamais** sollicité dans les cas suivants :

- un refus du modèle (`refusal`, `content_filter`) ;
- une requête invalide (400, 413, 422) ;
- un compte bloqué (401, 402 crédits épuisés, 403, 404) ;
- une réponse illisible.

Le secours partage la même clé et le même compte : il ne réglerait pas ces cas, et il ne doit pas servir à contourner un refus. Pour cette raison, le paramètre `models` d’OpenRouter n’est pas utilisé : il bascule aussi sur un refus de modération.

Si le secours échoue aussi, c’est l’échec du principal qui est rendu. La tâche est alors réessayée plus tard, comme avant.

**Disjoncteur.** Après 3 indisponibilités du principal en une minute, le secours répond directement pendant 2 minutes, puis le principal est retenté. L’état vit dans la mémoire de chaque processus (worker, fonction Vercel).

### Garde-fous identiques

La bascule a lieu au niveau de l’appel HTTP. Tout le reste est inchangé :

- les mêmes consignes, données de référence, marqueurs et plafond de sortie ;
- la même détection des répétitions ;
- la même vérification de l’état du contact et du projet ;
- la même réservation du quota de messages avant l’envoi.

Le raisonnement est désactivé (`reasoning: { enabled: false }`), pour que tout le plafond serve à la réponse.

### Journaux et coûts

Une bascule écrit une ligne du type `[ai] Bascule vers le modèle de secours. { feature, reason, fallback }`. Elle ne contient ni contenu de conversation, ni nom, ni numéro, ni corps d’erreur du fournisseur.

`ai_usage.model` enregistre le modèle qui a réellement répondu. La part du secours apparaît donc dans `/admin/ai-costs`.

**Limite.** Le secours passe aussi par OpenRouter : une panne d’OpenRouter lui-même les arrête tous les deux.

### Vérifier

```bash
npx tsx scripts/check-ai.ts
```

Le script envoie une conversation fictive au principal puis au secours, sans bascule possible. Il teste une réponse au client et un résumé (sortie JSON). Il consomme quelques jetons, n’enregistre rien et n’envoie rien sur WhatsApp.

## Budget de jetons d’une réponse

| Bloc | Plafond |
|---|---|
| Règles fixes et instructions de l’entreprise | ≈ 3 400 caractères de règles, plus 12 000 au plus pour les instructions |
| Données de référence | 16 000 caractères (`KNOWLEDGE_LIMITS.retrievalBudget`) |
| Historique | 20, 30 ou 50 messages selon l’offre, 6 000 caractères au total (`HISTORY_CHAR_BUDGET`). Les messages anciens sont abrégés à 2 000 caractères, le dernier reste entier |
| Sortie | 100, 200 ou 300 mots selon la longueur choisie, soit 200, 350 ou 550 jetons (`REPLY_MAX_TOKENS`) |

Quand une réponse atteint le plafond, elle est coupée à sa dernière phrase complète avant l’envoi.

**Cache du fournisseur.** Le prompt système commence par ce qui ne change pas : règles, instructions, puis données de référence. Viennent ensuite le nom du contact et la consigne anti-répétition. Si toute la base tient dans le plafond, elle garde le même ordre quelle que soit la question. Sinon, les entrées proches des derniers messages passent d’abord. Gemini 2.5 facture alors ce début au tarif du cache (25 % du prix), sans configuration. Les jetons servis par le cache sont mesurés dans `ai_usage.cachedTokens`.

**Instinct** lit les 30 derniers messages. Il ne rappelle pas le modèle quand seuls l’IA ou l’équipe ont écrit depuis sa dernière analyse. Le worker attend 30 s de calme après le dernier message du client, pour analyser une rafale de messages une seule fois.
