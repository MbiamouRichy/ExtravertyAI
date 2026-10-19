# Intégrations : webhooks, Make/Zapier et Google Sheets

Fonctionnalité réservée à l’offre **Business** (vérifiée côté serveur à chaque action et à chaque émission d’événement).

## Variables d’environnement

| Variable | Où | Rôle |
|---|---|---|
| `INTEGRATIONS_ENCRYPTION_KEY` | app + workers | Clé AES-256-GCM (32 octets en base64) qui chiffre les secrets de webhook et les jetons Google. **Obligatoire** : sans elle, la page affiche une alerte et rien ne peut être créé. Générer avec `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. Ne jamais la changer sans migrer les secrets existants (ils deviendraient illisibles). |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | app + outbound-worker | Mêmes identifiants que la connexion Google. |
| `BETTER_AUTH_SECRET` | app | Signe le paramètre `state` du consentement Google. |
| `BETTER_AUTH_URL` | app | Origine utilisée pour l’URI de redirection Google. |

## Google Cloud

1. Dans le client OAuth existant, ajouter l’URI de redirection autorisée :
   `https://<votre-domaine>/api/integrations/google/callback`
2. Activer l’**API Google Sheets** dans le projet Google Cloud.
3. Le scope demandé est `https://www.googleapis.com/auth/drive.file` (non sensible) : l’application ne voit que la feuille qu’elle crée. L’écran de consentement doit tout de même être publié (vérification de la marque) pour les comptes hors test.

## Fonctionnement

- Les événements sont écrits dans la table `integration_delivery` **dans la même transaction** que le changement qui les produit (outbox) : pas d’événement sans changement, pas de changement perdu.
- La boucle de livraison tourne dans le worker `outbound` existant (aucun service à ajouter à `compose.yaml`).
- Relances : 1 min, 5 min, 15 min, 1 h, 3 h, 6 h, 12 h (8 tentatives, environ 22 h). Un endpoint est désactivé après 20 échecs consécutifs ; un accès Google révoqué (401/403/404) le désactive immédiatement.
- Les webhooks passent par `lib/safe-fetch.ts` : HTTPS uniquement, adresses privées refusées à chaque connexion (protection SSRF et DNS rebinding), redirections non suivies, 10 s maximum.
- Google Sheets écrit en `valueInputOption=RAW` : une valeur commençant par `=` n’est jamais interprétée comme une formule.

## Événements

`contact.qualified`, `pipeline.stage_changed`, `conversation.resolved`, `conversation.assigned`, `csat.received`, plus `test.ping` (bouton « Tester »).

Corps envoyé (POST JSON) :

```json
{
  "id": "identifiant de livraison (stable entre les tentatives)",
  "event": "pipeline.stage_changed",
  "occurredAt": "2026-10-19T14:05:00.000Z",
  "projectId": "…",
  "data": { "contact": { "id": "…", "name": "Kevin M.", "phone": "24101000001" }, "...": "…" }
}
```

En-têtes : `X-Extraverty-Event`, `X-Extraverty-Delivery`, `X-Extraverty-Signature: t=<horodatage>,v1=<hex>`.

## Vérifier la signature (Node.js)

```js
import { createHmac, timingSafeEqual } from "node:crypto";

export function verify(secret, rawBody, header) {
  const { t, v1 } = Object.fromEntries(header.split(",").map((part) => part.split("=", 2)));
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false; // rejeu
  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest();
  const received = Buffer.from(v1 ?? "", "hex");
  return expected.length === received.length && timingSafeEqual(expected, received);
}
```

Utiliser le **corps brut** reçu (pas un JSON re-sérialisé). Dédupliquer avec `id` : une livraison peut arriver deux fois si votre serveur répond après le délai.

## Make et Zapier

- **Make** : module « Webhooks › Custom webhook », copier l’adresse, créer le webhook dans ExtravertyAI, cliquer sur « Tester ».
- **Zapier** : déclencheur « Webhooks by Zapier › Catch Hook », même procédure.
- Google Sheets peut aussi être alimenté via Make/Zapier si vous préférez votre propre feuille.

## Base de données

Les migrations `202610180001` à `202610180006` doivent être appliquées (`npm run db:deploy`) avant de déployer l’application et les workers.
