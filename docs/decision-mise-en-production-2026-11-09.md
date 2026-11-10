# Décision de mise en production — 9 novembre 2026

Branche `codex/preproduction`. Les tests ont été lancés sur le commit 87aa77c ; la branche est depuis passée à ff640be, un commit d'une autre session qui ne touche que la fenêtre « Votre avis ».
Production actuelle : `master` (caa9920). La préversion a **351 commits d'avance** sur la production, dont **56 fichiers de migration**.

## Décision : **NO-GO aujourd'hui**

La décision peut passer à **GO sous 1 à 3 jours**, une fois les 3 points bloquants restants levés (voir la fin du document). Le code est solide sur l'isolation entre projets et le contrôle des offres. Ce qui bloque, c'est l'exploitation : une base partagée avec la préversion sans restauration testée, et un encaissement réel jamais vérifié.

| # | Critère bloquant | Verdict | Preuve |
|---|---|---|---|
| 1 | Isolation entre projets | ✅ Rempli (code) | Revue des 123 fonctions serveur exportées et test d'accès croisé (§3, §4) |
| 2 | Offres impossibles à contourner | ✅ Rempli pour les 7 fonctions testées | Matrice testée et preuve « rouge si on retire le contrôle » (§4) |
| 3 | Paiement Polar | ❌ **Bloquant** | Signature vérifiée dans le code, mais aucun paiement réel ni versement vers le Gabon constaté (§7) |
| 4 | Webhook WhatsApp | ✅ Rempli (code), ⚠️ un risque à décider | Secret obligatoire et comparé à temps constant ; l'API WhatsApp n'est pas officielle (§8) |
| 5 | Pas de perte de données | ❌ **Bloquant** | Base partagée préversion/production, aucune restauration testée (§7) |
| 6 | Version figée et au vert | ⚠️ Presque | Build ✅, typage ✅, 441 tests sur 442 ✅, linter : 0 erreur dans le code (§1) |
| 7 | Sécurité minimale | ✅ Rempli le 10 novembre | `next` passé en 16.4.6 et `better-auth` en 1.7.19. Build, typage et 445 tests sur 445 verts. Plus aucune faille critique atteignable en production (§6) |
| 8 | Retour arrière et suivi des erreurs | ❌ **Bloquant** | Aucun outil de suivi des erreurs ; migrations en masse vers la production (§7) |

---

## 1. Figer la version

| Vérification | Résultat brut | Verdict |
|---|---|---|
| `npm run build` | Réussi, toutes les routes compilent | ✅ |
| `npm run typecheck` | 1er passage : 3 × `TS2307 Cannot find module '…/app/api/webhooks/stripe/route.js'`, de vieux fichiers de types dans `.next/`. Après le build : 0 erreur | ✅ |
| `npm run lint` | 1 824 erreurs et 25 338 avertissements, tous dans `.claude/worktrees/` et `.scratch/` (non exclus de la config). Sur le code : 0 erreur, 2 avertissements | ⚠️ Corriger `eslint.config.mjs` |
| `npm test` | 441 sur 442. Échec : `only the signed-in workspace is filtered`, car le test n'a pas suivi l'ajout voulu de `/maquettes` au proxy (bdc6707) | ⚠️ Mettre à jour le test |

Non commités : `.claude/launch.json` (configuration locale avec une clé locale : ne pas commiter), `.claude-deletion-fixture.ts` (script temporaire : à supprimer), et le nouveau `tests/plan-access-matrix.test.ts` (à commiter).

## 2. Critères bloquants

Ce sont les 8 critères validés le 9 novembre 2026. Un seul critère non rempli suffit pour un NO-GO.

## 3. Matrice des offres (tirée du code)

La source est `lib/plan-features.ts` et `lib/pricing.ts`. Les rôles ne changent rien aux offres : chaque réglage d'une fonction payante est réservé à OWNER et ADMIN (`project.manage`). Tous les contrôles listés sont appliqués **côté serveur**.

| Fonction | Starter | Pro | Business | Où le contrôle est appliqué | Testé ici |
|---|---|---|---|---|---|
| Messages / mois | 4 000 | 10 000 | 25 000 | `lib/message-quota.ts` (SQL `FOR UPDATE`) ; plafond lu dans `MESSAGE_LIMIT_*` | Refus si projet suspendu ou expiré |
| Utilisateurs | 2 | 4 | 10 | `app/actions/team.ts`, `lib/project-invitations.ts` | — |
| Notes vocales | ✗ | ✓ | ✓ | `lib/evolution-ingestion.ts`, `lib/message-extraction.ts` | — |
| Images | ✗ | ✗ | ✓ | idem | — |
| Instinct IA | ✗ | ✓ | ✓ | `lib/instinct-classification.ts` (worker) | — |
| Résumé IA | ✗ | ✓ | ✓ | `app/actions/summarizeConversation.ts` | — |
| Satisfaction | ✗ | ✓ | ✓ | `lib/csat.ts` | ✅ 18 cas |
| Webhooks | ✗ | ✓ | ✓ | `lib/integrations.ts`, `lib/integration-events.ts` | ✅ 18 cas |
| Google Sheets | ✓ | ✓ | ✓ | `app/api/integrations/google/start`, `lib/google-sheets.ts` | — |
| Diffusion | ✗ | 500 / 2 000 / 300 j | 2 000 / 10 000 / 1 000 j | `lib/broadcasts.ts` | ✅ 18 cas |
| Pipeline | ✗ | ✗ | ✓ | `lib/pipeline.ts` | ✅ 18 cas |
| Relances auto | ✗ | ✗ | ✓ (150/j) | `lib/follow-ups.ts` | ✅ 18 cas |
| Répartition auto | ✗ | ✗ | ✓ | `lib/team-auto-assign.ts` et déclencheur SQL | ✅ 18 cas |
| Rapports | ✗ | ✗ | ✓ | `lib/report-settings.ts`, `lib/weekly-report-service.ts` | ✅ 18 cas |
| Historique Analytics | 30 j | 90 j | 365 j | `app/actions/analytics.ts`, `lib/analytics-access.ts` | — |
| Connaissances, PDF | 20 k mots, 5 sources | 150 k, 10 | 600 k, 20 | `lib/knowledge.ts` | — |
| Stockage | 500 Mo | 1,2 Go | 3 Go | `lib/storage-quota.ts` | — |
| Mémoire, tests de l'agent | 20 / 30 par jour | 30 / 100 | 50 / 300 | `lib/ai-jobs.ts`, `lib/agent-sandbox.ts` | — |

**Fonctions contrôlées seulement dans l'interface : aucune trouvée.** La recherche a parcouru `app`, `lib` et `workers`. Les pages lisent l'offre pour l'affichage, et l'action serveur qu'elles appellent refait le contrôle.

**Écarts entre la page tarifs et le code :**
1. **Il n'existe pas d'offre gratuite.** Le code propose Starter à 15,99 $ par mois, Pro à 39,99 $ et Business à 99 $, avec un essai de 10 jours. Le « Gratuit » de votre découpage n'existe pas dans le code.
2. **Le quota de messages a deux sources.** La page tarifs affiche `messageLimit` (`lib/pricing.ts`), mais le serveur applique `MESSAGE_LIMIT_*` (`lib/billing-quota.ts`). Une valeur différente sur Vercel ou sur les workers créerait un écart silencieux. → Vérifier ces variables, ou faire échouer le démarrage si elles diffèrent de `pricing.ts`.
3. `/tarifs` redirige vers `/#tarifs`. Il n'y a pas de page tarifs séparée : les fonctions affichées sont `PLAN_CAPABILITIES`, gardées cohérentes avec `PLAN_FEATURES` par les tests existants.
4. Le « Support prioritaire » (Pro, Business) est une promesse de service sans aucun support dans le code. Pour une seule personne, c'est un engagement risqué.

## 4. Tests d'accès

Fichier : `tests/plan-access-matrix.test.ts`, lancé avec `npx tsx --test tests/plan-access-matrix.test.ts`.

- **Matrice** : 3 offres × 6 rôles × 7 fonctions = **126 cas**. Pour chaque cas, un projet neuf et un appel direct à la fonction serveur, sans passer par l'interface. Les offres attendues sont écrites à la main d'après la grille tarifaire. ✅ Tous réussis.
- **D'un projet à l'autre** : le propriétaire d'un projet Business appelle les 7 fonctions sur le projet Business d'un autre. Tout est refusé et l'autre projet est identique à l'octet près. ✅
- **Changements d'offre** : passage de Starter à Business (refus puis accès), de Business à Starter (refus), paiement échoué (`paused`) et expiration (`inactive`). Dans ces deux derniers cas, rapports et envoi de messages sont refusés. ✅
- **Preuve que les tests de refus détectent bien un contrôle retiré** : chaque contrôle a été retiré un à la fois, puis le fichier restauré.

| Contrôle retiré | Résultat |
|---|---|
| Offre : relances, répartition, rapports, satisfaction, webhooks, pipeline, diffusion (7) | 🔴 Rouge, les 7 |
| Paiement des rapports | 🔴 Rouge |
| Rôle (diffusion, réglages) | 🔴 Rouge, les 2 |
| Projet (appartenance remplacée par « membre d'un projet quelconque ») | 🔴 Rouge |
| Statut du projet dans le quota | 🟢 **Resté vert** : un 2e verrou (la recherche de la période du quota) refuse déjà. Défense en profondeur, mais cette ligne n'est pas couverte seule |

**Non couvert aujourd'hui** :
- Les tests passent par les fonctions serveur, pas par HTTP : l'enveloppe session → `userId` des actions n'est pas exercée. Elle est relue dans le code : 26 actions signalées par l'analyse automatique, toutes vérifiées à la main ; elles délèguent le contrôle à `requireProjectAdmin`, `requireBroadcastAdmin` ou à une requête SQL qui fait la jointure sur `project_membership`.
- Fonctions non testées : notes vocales, images, Instinct, résumé, Analytics, places, stockage, connaissances.
- Pour couvrir le reste : une version de test locale qui démarre (voir §5), un compte par offre et par rôle créé par script, et des tests Playwright `*.api.spec.ts` qui appellent les routes `/api/projects/*`.

## 5. Inventaire des routes et exploration

**45 routes de pages** tirées de `app/**/page.tsx` : 14 publiques, 17 de projet, `/projects`, `/projects/new`, `/projects/user`, 3 `/admin`, 9 `/maquettes`. **22 routes API** tirées de `app/api/**/route.ts`.

**Exploration faite** : site en ligne (`www.extravertyai.com`, donc la version `master`), 15 pages publiques, 90 captures (375, 768 et 1280 px, clair et sombre).
- 404 : **aucun** sur les 12 liens découverts.
- Erreurs console : 1, un avertissement CSP (`upgrade-insecure-requests` ignoré dans une politique report-only).
- Erreurs réseau : seulement les redirections Google OAuth interrompues par le robot, pas un défaut.
- Boutons : 34 cliqués sans erreur, 4 ignorés parce qu'ils déclenchent une action. « Recevoir un code » sur `/sign-in` a été cliqué avec le champ e-mail vide : l'erreur relevée vient de cette validation, aucun code n'a été envoyé.

**Non couvert** : les pages connectées. Le serveur de dev local (`next-dev-local-db`) est resté bloqué plus de 10 minutes sur sa première compilation (« Slow filesystem detected », mise en cache de 9,9 min), même après redémarrage. Pour les couvrir : `next build` avec les variables locales puis `next start`, ou une préversion Vercel avec un compte de test que vous désignez. Le script d'exploration est prêt (il se connecte, visite les 17 pages de projet et clique les boutons sans effet).

## 6. UI/UX et sécurité

### Accessibilité (axe-core, pages publiques)
| Page | Contraste | Autre | Débordement horizontal | Note /7* |
|---|---|---|---|---|
| `/sign-in`, `/sign-up`, `/forget-password`, `/reset-password`, `/verify`, `/invite` | 0 | 0 | non | **7** |
| `/` (et `/tarifs`, `/goodbye`) | 1 à 2 éléments | `landmark-complementary-is-top-level` | non | **6** |
| `/apropos`, `/contact` | 1 à 3 | idem pour `/contact` | non | **6** |
| `/donneesEtConfidentialite`, `/remboursement`, `/conditions` | 6 à 13 (1280 px seulement) | — | non | **5** |

\*Grille : accessibilité /3 (3 = aucun défaut, 2 = défauts mineurs sur au plus 3 éléments, 1 = plus de 5 éléments), responsive /2, erreurs console et réseau /2. Le contraste en défaut est `#737373` sur `#f5f5f5` : un rapport de **4,34 au lieu de 4,5**, sur du texte secondaire de très petite taille (7,5 à 9 pt). Les heuristiques de Nielsen n'ont été jugées que sur `/sign-up` : page claire, un seul objectif, un seul bouton principal, gravité 0.
**À vérifier** : le bouton « Continuer avec Tiktok » est affiché, alors que `.env.example` le dit facultatif. S'il n'est pas configuré en production, c'est un bouton mort (gravité 3).

**Non couvert** : Lighthouse mobile (quota gratuit de l'API PageSpeed épuisé), les pages connectées, les états vide, chargement, erreur et succès, et la grille complète de Nielsen. Pour les couvrir : `npx lighthouse` en local et l'exploration des pages connectées (§5).

### Sécurité
- **Mise à jour du 10 novembre 2026**
  - Versions : `next` et `eslint-config-next` en 16.4.6, `better-auth` et `@better-auth/prisma-adapter` en 1.7.19.
  - Résultats : typage sans erreur, `npm test` à 445 sur 445 (le test du proxy a été mis à jour), build réussi.
  - `npm audit --omit=dev` : 23 vulnérabilités, dont 2 critiques que la production ne peut pas atteindre.
    - `dompurify`, via `jspdf` : seule la conversion HTML de `jspdf` s'en sert, et `lib/exportFile.ts` ne l'utilise pas.
    - `proxy-addr`, via l'outil en ligne de commande `shadcn`.
  - Effet secondaire : la nouvelle version 7.1.1 de `eslint-plugin-react-hooks` signale 22 erreurs dans 15 composants (refs lues pendant le rendu, `setState` dans un effet, fonctions impures). Ni la CI ni `next build` ne lancent le lint, donc rien n'est bloqué, mais ces erreurs sont à corriger.
- **Constat initial, `npm audit --omit=dev`** : 27 vulnérabilités (4 critiques, 11 élevées). **Deux sont bloquantes** :
  - `next` **16.3.3** : *Unauthenticated RCE in Image Optimization API when SVG files are used* (GHSA-2464-fhr4-w9xw), *RCE in `use cache` functions returning typed arrays* (GHSA-673q-mjm6-r5xr), plus un SSRF dans l'optimisation d'images. **Correctif : 16.4.6.**
  - `better-auth` **1.7.5** : *OAuth state can be used as a Magic Link to sign in as another user* (GHSA-965c-763c-88jm, critique) et *OAuth Proxy lets an attacker sign in as another user*. C'est une prise de contrôle de compte, et l'app utilise Google OAuth. **Correctif : au moins 1.7.7** (dernière version : 1.7.18).
  - Les autres viennent surtout de dépendances de développement rangées dans `dependencies` (`shadcn` → `express`/`proxy-addr`, `prisma` → `mysql2`) ou de `jspdf` → `dompurify`, qui tourne côté client. Non bloquant, mais `shadcn` et `prisma` devraient passer en `devDependencies`.
- **Secrets** : aucun dans les fichiers suivis ni dans l'historique Git (recherche par motifs : clés OpenRouter, Polar, Resend, Google, AWS, clés privées, URL PostgreSQL avec mot de passe). Seul `.env.example` est suivi. ⚠️ `.scratch/` contient des clés SSH privées de déploiement (`preview-deploy-key`). Ce dossier est ignoré par Git, mais c'est un risque sur cette machine.
- **En-têtes HTTP en production** : HSTS 2 ans avec `includeSubDomains`, `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, et `X-Powered-By` masqué. ✅ Il n'y a pas de CSP complète (`script-src`), ce qui n'est pas bloquant.
- **Contrôle d'accès côté serveur** : 123 fonctions exportées (actions et routes) analysées automatiquement, et les 26 signalées vérifiées à la main. Elles sont toutes contrôlées par délégation ; les 3 sans session le sont volontairement (retour anonyme après suppression du compte, mesure d'audience, back-office protégé par `getAdminForAction`).
- **Webhook Evolution** : le secret est accepté dans l'URL (`?secret=`), donc il apparaît dans les journaux Vercel. Préférer l'en-tête `x-webhook-secret` (non bloquant).

## 7. Exploitation

### Retour arrière
- **Code** : « Instant Rollback » de Vercel vers le déploiement précédent. Il ne restaure **pas** la base.
- **Base** : `vercel-build` applique les migrations à chaque déploiement de production. Or 56 fichiers de migration séparent `master` de la préversion. Une sauvegarde **juste avant** la mise en production est obligatoire, et la règle « suppression en deux temps » (`docs/vercel-preproduction.md`) doit être respectée.
- **Workers** : le script de la préversion redémarre les anciens conteneurs si la migration échoue. Il n'existe **aucun déploiement de production des workers** : le workflow GitHub ne déploie que `codex/preproduction`.

### Suivi des erreurs
**Aucun outil.** Pas de Sentry ni d'`onRequestError`, seulement `console.error`, lisible dans les journaux Vercel (durée de conservation limitée) et dans `docker compose logs`. À prévoir au minimum : `instrumentation.ts` avec `onRequestError` envoyé vers Sentry (offre gratuite), et une alerte e-mail sur les erreurs 5xx du webhook WhatsApp.

### Base de production séparée et workers de production
Ce qui existe aujourd'hui : un VPS Hostinger KVM2 et un conteneur PostgreSQL `postgresql-mi4k-postgresql-1`, qui contient la base `extravertyai_preview` partagée par la préversion et la production. Vercel l'atteint par `db-preview.extravertyai.com:32768`. Les workers tournent dans un clone du dépôt, avec `.env.production` et `compose.override.yaml`, déployés par `.github/workflows/deploy-preview.yml`.

**Recommandation : sur le même VPS, une seconde base et une seconde pile de workers.** Coût supplémentaire nul ; c'est l'organisation que `docs/deployment.md` prévoit déjà (`WORKER_ENV_FILE`).

1. **Créer la base**, dans le conteneur PostgreSQL existant, avec un rôle dédié qui n'a aucun droit sur la préversion :
   ```sql
   CREATE ROLE extraverty_prod LOGIN PASSWORD '<long mot de passe aléatoire>';
   CREATE DATABASE extravertyai_production OWNER extraverty_prod;
   REVOKE ALL ON DATABASE extravertyai_production FROM PUBLIC;
   ```
2. **Cloner le dépôt dans un second dossier** (par exemple `/opt/extravertyai-production`) sur `master`. Y créer :
   - un `.env.production` propre à la production : `DATABASE_URL=postgresql://extraverty_prod:…@postgresql:5432/extravertyai_production`, clés Polar **production** (`POLAR_SERVER` vide), URL publiques `https://www.extravertyai.com`, même serveur Evolution ;
   - le même `compose.override.yaml` (réseau externe `postgresql-mi4k_default`).
3. **Appliquer les migrations sur la base vide**, puis démarrer avec un nom de projet Compose distinct pour ne pas remplacer les conteneurs de la préversion :
   ```bash
   docker compose -p extravertyai-prod build
   docker compose -p extravertyai-prod run --rm --no-deps outbound-worker ./node_modules/.bin/prisma migrate deploy
   docker compose -p extravertyai-prod up -d
   ```
4. **Vercel → Settings → Environment Variables → Production** : `DATABASE_URL` vers `…@db-preview.extravertyai.com:32768/extravertyai_production?sslmode=require`, avec l'adresse publique et non le nom Docker (voir l'incident P1001). Idéalement, créer un nom distinct, `db.extravertyai.com`.
5. **Polar production** : webhook vers `https://www.extravertyai.com/api/webhooks/polar`, avec son propre secret.
6. **Sauvegardes** : une tâche `cron` quotidienne `pg_dump -Fc extravertyai_production`, **copiée hors du VPS** (MinIO tourne sur la même machine, donc ce n'est pas une copie distincte). **Une restauration testée** sur une base jetable avant le premier client.
7. **Déploiement automatique** : dupliquer `deploy-preview.yml` en `deploy-production.yml` (déclenché par `master`), avec une clé SSH dédiée et un script qui refuse toute base autre que `extravertyai_production`.

⚠️ **Piège à connaître : le numéro de vérification (OTP).** Une instance Evolution n'a qu'une seule adresse de webhook. Si la préversion et la production partagent `OTP_WHATSAPP_INSTANCE`, un seul des deux environnements recevra les codes. Prévoir un 2e numéro pour la préversion, ou accepter que la vérification par WhatsApp ne marche pas en préversion.

Alternative plus sûre mais payante : une base gérée (Neon ou Supabase), avec sauvegardes et restauration à un instant donné incluses. Les workers du VPS s'y connectent en TLS. Elle supprime le port PostgreSQL ouvert sur Internet et la dépendance à un seul VPS.

### Paiement
- **Le Gabon figure dans la liste des pays où Polar verse les fonds** ([Polar, pays pris en charge](https://polar.sh/docs/merchant-of-record/supported-countries)). Les versements passent par Stripe Connect Express, sur un compte bancaire **au Gabon, en monnaie locale**. Reste à vérifier : l'ouverture en tant que **particulier, sans société** ; un compte bancaire XAF accepté ; un **vrai paiement de 1 $ encaissé puis versé**. Tant que ce n'est pas fait, le critère 3 n'est pas rempli.
- **Frais** : 4 % + 0,40 $ par transaction d'après la documentation de Polar ([frais](https://docs.polar.sh/documentation/polar-as-merchant-of-record/fees)). Une source concurrente parle de 5 % + 0,50 $ pour les nouveaux comptes et de +1,5 % pour les cartes non américaines ([Dodo Payments](https://dodopayments.com/blogs/polar-sh-review)), à vérifier sur votre compte.
- **Risque produit majeur** : Polar n'accepte que la carte bancaire. Vos clients paient surtout par Mobile Money : 517 millions de comptes en Afrique de l'Ouest et 128 millions en Afrique centrale en 2025 ([GSMA via Ecofin](https://www.ecofinagency.com/news/2603-54111-africa-accounts-for-two-thirds-of-global-mobile-money-flows-in-2025)). Aucune source trouvée sur le taux de cartes chez les PME : c'est à mesurer dans les entretiens (question 7).

## 8. Avis produit et marché

### Le fait qui change tout
**L'app ne passe pas par l'API WhatsApp Business officielle de Meta**, mais par Evolution API, qui se connecte comme WhatsApp Web (Baileys). Les sources s'accordent à dire que ce mode viole les conditions de WhatsApp et expose le numéro à un **blocage, parfois définitif et sans appel** ([comparatif Evolution / Cloud API](https://pasqualepillitteri.it/en/news/12969/integrate-whatsapp-evolution-api-vs-cloud-api), [ChatDaddy](https://help.chatdaddy.tech/article/ban-type-distribution)). Ce sont des sources d'éditeurs. Le chiffre souvent cité de « 68 % de PME bannies en 12 mois » n'a pas de source primaire. Pour vos clients, perdre leur numéro, c'est perdre leur fichier client : c'est le risque n°1.
Avantage inverse : **aucun coût Meta par message** et une connexion par QR code, sans validation Meta. C'est ce qui permet vos prix.

### Fonction par fonction (hypothèses à confirmer en entretien)
| Fonction | Verdict | Pourquoi |
|---|---|---|
| Réponse IA 24 h/24 sur WhatsApp | **Vrai besoin, c'est le cœur** | Les PME vendent sur WhatsApp et répondent tard ; une réponse manquée est une vente perdue |
| Notes vocales comprises | **Vrai besoin, à mettre dans Starter** | Le vocal est très répandu chez les clients ; un assistant qui ne les comprend pas paraît cassé |
| Messagerie d'équipe, reprise en main, notes | Vrai besoin | Dès 2 vendeurs sur un même numéro |
| Base de connaissances | Vrai besoin | Prix, livraison, stock : c'est ce que les clients demandent |
| Diffusion | Vrai besoin… **et accélérateur de blocage** | Les envois en masse sur une API non officielle sont la première cause de signalement |
| Relances automatiques | Utile, même risque | À brider fortement |
| Instinct IA, pipeline, valeur des affaires | Plutôt gadget au lancement | Les PME cibles ne pilotent pas un pipeline ; utile pour plus tard |
| Satisfaction, rapports hebdomadaires, webhooks, Google Sheets, répartition automatique | **Gadget au lancement** | Peu de PME africaines de 1 à 5 personnes branchent Make ou Zapier |
| Images comprises (Business seulement) | Vrai besoin, mal placé | Les clients envoient des captures de produits ; à proposer dès Pro |
| **Manquant : catalogue et prise de commande** | Manque majeur | Le client veut « commande reçue, total, adresse », pas des statistiques |
| **Manquant : lien de paiement Mobile Money** | Manque majeur | Fermer la vente dans la conversation |
| **Manquant : sauvegarde des contacts hors WhatsApp** | Manque majeur | La seule protection contre la perte du numéro |

**Pour le lancement** : retirer ou masquer le pipeline, les rapports, la satisfaction et les webhooks. Passer les notes vocales en Starter. Réduire le message à « un vendeur IA qui répond à vos clients WhatsApp, même la nuit ».

### Concurrence
| | Prix mensuel | Coût Meta | Simplicité | Note |
|---|---|---|---|---|
| WhatsApp Business (app) | **Gratuit** | 0 | Maximale | Catalogue, réponses rapides, pas d'IA ni d'équipe |
| Wati | ≈ 49 à 69 $ et plus | Facturé en plus, avec marge ([eesel](https://www.eesel.ai/blog/wati-pricing)) | Moyenne | API officielle, modèles validés par Meta |
| Respond.io | 79 à 279 $ (paiement annuel) ([eesel](https://www.eesel.ai/blog/respond-io-pricing)) | Facturé au prix Meta | Faible (outil complet) | Pour des équipes structurées |
| Interakt | ≈ 12 à 83 $ selon les sources ([Toolradar](https://toolradar.com/tools/interakt/pricing)) | Avec marge | Moyenne | Marché indien |
| **ExtravertyAI** | **15,99 / 39,99 / 99 $** | 0 (non officiel) | **Élevée** (QR code) | En français, IA incluse, pas de validation Meta |

**Pourquoi on vous choisirait** : c'est le seul outil en français, à moins de 16 $, qui répond aux clients WhatsApp avec une IA en quelques minutes, sans démarche auprès de Meta.
**Pourquoi on ne vous choisirait pas** : WhatsApp Business est gratuit et suffit à qui répond lui-même. Et le risque de perdre son numéro, plus le paiement par carte seulement, découragent les autres.

### Offres, prix et marge
Le découpage ne pousse pas bien à monter en gamme. Les fonctions qui feraient passer à Pro sont surtout des gadgets pour cette cible (Instinct, satisfaction, webhooks). Le vrai déclencheur est le volume de messages et le nombre d'utilisateurs. **Proposition** : Starter avec les notes vocales ; Pro = plus de messages, images, diffusion ; Business = équipe et volume.

Marge par client **au quota plein** (hypothèses ci-dessous) :

| | Starter | Pro | Business |
|---|---|---|---|
| Prix | 15,99 $ | 39,99 $ | 99,00 $ |
| Frais Polar (≈ 5,5 % + 0,40 $) | −1,28 | −2,60 | −5,85 |
| IA (≈ 0,001 $ par message envoyé) | −4,00 | −10,00 | −25,00 |
| Hébergement (≈ 60 $ par mois ÷ 20 clients) | −3,00 | −3,00 | −3,00 |
| **Marge (API actuelle, sans frais Meta)** | **7,71 $ (48 %)** | **24,39 $ (61 %)** | **65,15 $ (66 %)** |
| Si passage à l'API officielle : messages de service ≈ 0,004 $ au-delà de 1 000 gratuits | −12 | −36 | −96 |
| **Marge avec l'API officielle** | **−4,29 $** | **−11,61 $** | **−30,85 $** |

Hypothèses :
- Coût IA : `google/gemini-2.5-flash-lite` à 0,10 $ et 0,40 $ par million de jetons ([OpenRouter via Maxim](https://www.getmaxim.ai/bifrost/llm-cost-calculator/provider/openrouter/model/gemini-2.5-flash-lite)), soit ≈ 6 000 jetons en entrée et 300 en sortie par réponse, plus Instinct et la transcription. **À remplacer par le coût réel** de `/admin/ai-costs`, mesuré depuis novembre 2026.
- Tarif Meta « Rest of Africa » : ≈ 0,004 $ par message de service ou utilitaire facturé à partir du 1er octobre 2026 ([Meta](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing) ; montants issus de [Unipile](https://www.unipile.com/whatsapp-business-api-pricing/), qui varient d'une source à l'autre).
- En usage réel (souvent 20 à 40 % du quota), les marges sont bien meilleures.

**Conclusion** : vos prix ne tiennent **que** grâce à l'API non officielle. Passer à l'API officielle imposerait de diviser les quotas par 3 ou 4, ou de facturer les messages en plus.

**Prix supportables ?** 15,99 $ font environ 9 500 FCFA par mois. C'est raisonnable pour une boutique qui vend chaque jour sur WhatsApp, et cher pour une micro-vendeuse. À valider par des préventes, pas par intuition.

### Pré-mortem : l'app a échoué dans 12 mois
1. **Des numéros clients bannis** après des diffusions : bouche-à-oreille négatif, départs en série.
2. **Personne n'a pu payer** : pas de carte, pas de Mobile Money. L'essai de 10 jours ne s'est pas converti.
3. **« WhatsApp Business me suffit »** : la valeur de l'IA n'a pas été perçue assez vite, et l'offre était trop large et trop technique (pipeline, webhooks).
4. **Un support intenable pour une seule personne** : QR code déconnecté, téléphone éteint, instance tombée. La promesse « 24 h/24 » a été rompue.
5. **Un incident de données** : perte ou mélange entre préversion et production, sans sauvegarde restaurable, ou exploitation d'une faille non corrigée.

### Chances de réussite : **faibles à moyennes**
Elles passent à « moyennes » si les hypothèses H1 à H4 tiennent dans les 30 jours.

| Hypothèse | Comment la vérifier en 30 jours | Seuil |
|---|---|---|
| H1 Les PME paient pour ne plus perdre de ventes la nuit | 15 entretiens avec des PME qui vendent sur WhatsApp (Libreville, Douala, Abidjan) | ≥ 8 sur 15 décrivent une perte réelle |
| H2 Elles peuvent payer | Préventes : 3 mois de Starter payés d'avance, par Mobile Money ou carte | ≥ 5 préventes |
| H3 L'essai se convertit | 20 essais accompagnés | ≥ 25 % deviennent payants |
| H4 Le numéro tient | Suivi des blocages sur tous les numéros connectés, avec la diffusion bridée | 0 blocage en 30 jours |
| H5 La marge tient | Coût IA réel par client dans `/admin/ai-costs` | < 25 % du prix |

---

## Pour passer à GO (1 à 3 jours)
1. ~~Mettre à jour `next` et `better-auth`~~ : **fait le 10 novembre** (16.4.6 et 1.7.19). Build, typage et tests verts. *(critère 7)*
2. **Séparer la base de production**, appliquer les migrations, sauvegarder hors du VPS, **tester une restauration**. *(critère 5)*
3. **Faire un paiement réel de bout en bout** sur Polar production et voir les fonds arriver au Gabon. *(critère 3)*
4. **Brancher un outil de suivi des erreurs** et écrire la procédure de retour arrière. *(critère 8)*
5. Petites corrections : mettre à jour le test du proxy, exclure `.claude/` et `.scratch/` du linter, commiter `tests/plan-access-matrix.test.ts`. *(critère 6)*
6. **Décision écrite sur l'API non officielle**, et une mention claire du risque de blocage dans les conditions d'utilisation. *(risque n°1)*

## Top 10 des corrections
1. Corriger les failles de `next` et `better-auth` (sécurité, critique).
2. Séparer la base de production, avec des sauvegardes hors du VPS et une restauration testée.
3. Mettre en place le suivi des erreurs et une alerte sur le webhook WhatsApp.
4. Brider la diffusion et les relances, et afficher le risque de blocage avant le premier envoi.
5. Exporter les contacts hors de WhatsApp, mis en avant comme protection.
6. Proposer le paiement Mobile Money (ou un paiement manuel en attendant).
7. Simplifier les offres : notes vocales dans Starter ; masquer pipeline, rapports, satisfaction et webhooks au lancement.
8. Lire le quota de messages à une seule source (`pricing.ts` et `MESSAGE_LIMIT_*`).
9. Corriger le contraste du texte secondaire (`--muted-foreground` sur `--muted` à 4,34 : viser 4,5) et le repère `aside` imbriqué.
10. Masquer « Continuer avec Tiktok » s'il n'est pas configuré en production.

## Script de test : 3 à 5 vrais utilisateurs, Android d'entrée de gamme
**Matériel** : Android à 2 Go de RAM (Tecno, Itel ou Samsung série A), Chrome, réseau 3G ou 4G réel. Un second téléphone joue le client. Durée : 45 min. Vous observez sans aider ; l'utilisateur pense à voix haute. Notez le temps et les blocages.

1. « Vous avez entendu parler d'ExtravertyAI. Trouvez à quoi ça sert et combien ça coûte. » → Le prix en FCFA est-il compris ? Le temps passé ?
2. « Créez votre compte. » → Le code arrive-t-il ? En combien de temps ?
3. « Créez votre boutique et connectez votre WhatsApp. » → Le QR code scanné avec **le même téléphone** est le point critique.
4. « Expliquez à l'assistant ce que vous vendez, vos prix et la livraison. » → Les champs sont-ils compris ?
5. « Testez l'assistant comme si vous étiez un client. »
6. Depuis le 2e téléphone : un client écrit, puis envoie **une note vocale**, puis une photo. → Les réponses sont-elles justes ? En combien de temps ?
7. « Reprenez la conversation vous-même, puis rendez la main à l'assistant. »
8. « Ajoutez un collègue. »
9. « Payez l'abonnement. » → Arrêtez-vous à l'écran de paiement : quel moyen la personne attendait-elle ?
10. Questions de fin : « Qu'est-ce qui vous a gêné ? Paieriez-vous ? Combien ? Qu'est-ce qui vous ferait peur ? »

À mesurer : tâches réussies sans aide, temps des tâches 3 et 6, nombre de « je ne comprends pas », et le moyen de paiement attendu.

## 10 questions pour les prospects
Parler de faits passés, pas d'intentions.
1. Racontez-moi la dernière fois qu'un client vous a écrit sur WhatsApp et que vous avez répondu trop tard. Qu'est-ce qui s'est passé ?
2. Combien de messages clients recevez-vous un jour normal ? Et un jour de promotion ?
3. Qui répond aujourd'hui, à quelles heures, et que se passe-t-il la nuit ?
4. Quelle part de vos ventes passe par WhatsApp ? Avez-vous perdu une vente le mois dernier faute de réponse ?
5. Utilisez-vous déjà un outil en plus de WhatsApp Business ? Lequel, et pourquoi l'avez-vous gardé ou abandonné ?
6. Votre numéro a-t-il déjà été bloqué ou suspendu ? Qu'avez-vous perdu ce jour-là ?
7. Comment payez-vous vos abonnements aujourd'hui (Mobile Money, carte, espèces) ? Avez-vous une carte qui marche sur Internet ?
8. Combien payez-vous par mois pour vos outils (internet, crédit, applis) ? Qu'est-ce qui vous paraîtrait cher ?
9. Si un assistant répondait à votre place avec vos prix, qu'est-ce qui vous ferait peur ?
10. Je vous propose 3 mois à [prix] payés aujourd'hui, avec mise en place offerte : on le fait ? *(la prévente : un « oui » sans paiement ne compte pas)*
