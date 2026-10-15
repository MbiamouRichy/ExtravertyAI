<div align="center">
  <a href="https://www.extravertyai.com">
    <img src="./public/logo.png" alt="Logo Extraverty AI" width="120" />
  </a>

  <h1>Extraverty AI</h1>

  <p><strong>Automatisez les réponses à vos clients sur WhatsApp grâce à l'IA.</strong></p>

  <p>
    <a href="https://www.extravertyai.com">Site</a> ·
    <a href="./docs/deployment.md">Déploiement</a> ·
    <a href="https://www.extravertyai.com/contact">Contact</a>
  </p>
</div>

---

## Présentation

Extraverty AI est une application SaaS qui connecte le numéro WhatsApp d'une entreprise à un assistant IA. L'assistant répond aux clients 24 h/24, repère les prospects intéressants et laisse l'équipe reprendre la main sur une conversation à tout moment.

Chaque entreprise crée un **projet** (un numéro WhatsApp). Elle y configure son agent, invite son équipe et suit ses conversations depuis un tableau de bord.

## Fonctionnalités

| Domaine | Ce que fait l'application |
| --- | --- |
| **Connexion WhatsApp** | Liaison du numéro via [Evolution API](https://doc.evolution-api.com/), réception des messages par webhook signé, suivi des statuts (envoyé, distribué, lu). |
| **Agent IA** | Agent propre à chaque projet : nom, message système, ton, longueur, langue et comportements. Il faut le valider avant la première réponse automatique. |
| **Reprise humaine** | Un membre de l'équipe peut répondre lui-même à tout moment. L'IA s'efface et les réponses automatiques en attente sont annulées. |
| **Instinct** | Classement automatique de chaque client : *intéressant* (devis, prix, commande), *à relancer* (hésitant, reporté) ou *aucun*. |
| **Médias** | Transcription des notes vocales et analyse des images, pour que l'IA en tienne compte. |
| **Boîte de réception** | Contacts, conversations en temps réel (Pusher), résumés IA des échanges, suivi des messages lus, envoi de notes vocales. |
| **Équipe** | Comptes (email ou Google), invitations, rôles, présence en ligne et notifications. |
| **Facturation** | Abonnements Stripe avec essai gratuit, quotas de messages par période et emails de facturation. |
| **Statistiques et rapports** | Tableau de bord, rapports hebdomadaires par email (Business), exports CSV, Excel, PDF et Word. |

## Fonctionnement

```
Client WhatsApp
      │
      ▼
Evolution API ──webhook──▶ Application Next.js ──▶ PostgreSQL
                                                   (contact, message, tâche IA)
                                                          │
                                                          ▼
                                                   Worker IA ──▶ OpenRouter
                                                   (réponse + réservation du quota)
                                                          │
                                                          ▼
                                                   Worker d'envoi ──▶ Evolution API ──▶ Client
```

Chaque étape est enregistrée en base avant de passer à la suivante : un redémarrage ne perd aucun message. Une génération échouée est retentée jusqu'à trois fois. Un message dont l'envoi est incertain n'est jamais renvoyé automatiquement, pour éviter les doublons chez le client. Tous les détails sont dans [`docs/deployment.md`](./docs/deployment.md).

## Offres

Les offres sont définies dans [`lib/pricing.ts`](./lib/pricing.ts). Les plafonds réellement appliqués viennent des variables `MESSAGE_LIMIT_*`.

| | Starter | Pro | Business |
| --- | --- | --- | --- |
| Prix mensuel | 15,99 $ | 39,99 $ | 99 $ |
| Utilisateurs | 2 | 4 | 10 |
| Messages / mois | 4 000 | 10 000 | 25 000 |
| Notes vocales | — | ✓ | ✓ |
| Images | — | — | ✓ |
| Résumés IA et qualification des prospects | — | ✓ | ✓ |
| Historique des statistiques | 30 jours | 90 jours | 12 mois |
| Rapports programmés | — | — | ✓ |

## Stack technique

- **Application web** : [Next.js 16](https://nextjs.org/) (App Router), React 19, TypeScript
- **Interface** : Tailwind CSS 4, [shadcn/ui](https://ui.shadcn.com/), Motion, Recharts
- **Formulaires** : React Hook Form et Zod
- **Données** : PostgreSQL et [Prisma 7](https://www.prisma.io/)
- **Authentification** : [Better Auth](https://www.better-auth.com/) (email/mot de passe, Google)
- **WhatsApp** : Evolution API
- **IA** : [OpenRouter](https://openrouter.ai/) (réponses, vision, transcription audio, classement Instinct)
- **Temps réel** : Pusher
- **Paiement** : Stripe
- **Emails** : Resend
- **Stockage de fichiers** : MinIO / S3
- **Tests** : `node:test` via `tsx`, Playwright

## Démarrage en local

### Prérequis

- Node.js 22 et npm
- Une base PostgreSQL
- Des comptes ou clés de test pour Evolution API, OpenRouter, Pusher, Stripe, Resend et un stockage S3/MinIO

### Installation

```bash
git clone https://github.com/MbiamouRichy/ExtravertyAI.git
cd ExtravertyAI
npm install

# Variables d'environnement : copier le modèle puis le compléter
cp .env.example .env

# Appliquer les migrations de la base
npm run db:deploy

# Lancer l'application web
npm run dev
```

L'application est disponible sur [http://localhost:3000](http://localhost:3000).

Sans les workers, les messages entrants sont enregistrés mais personne n'y répond. Pour tester tout le parcours, lancer chaque worker dans un terminal séparé :

```bash
npm run worker:ai        # génère les réponses IA
npm run worker:outbound  # envoie les messages sur WhatsApp
npm run worker:billing   # gère les emails et le cycle de facturation
npm run worker:reports   # envoie les rapports hebdomadaires
```

> Ne commitez jamais de secrets : tous les fichiers `.env*` sont ignorés par Git, sauf `.env.example`.

## Scripts

| Commande | Rôle |
| --- | --- |
| `npm run dev` | Serveur de développement |
| `npm run build` | Génère le client Prisma et compile l'application |
| `npm start` | Démarre l'application compilée |
| `npm run db:deploy` | Applique les migrations Prisma |
| `npm run lint` | Lint ESLint |
| `npm run typecheck` | Vérification TypeScript |
| `npm test` | Tests unitaires et d'intégration (`tests/*.test.ts`) |
| `npm run test:e2e` | Tests de bout en bout Playwright |
| `npm run test:e2e:report` | Ouvre le dernier rapport Playwright |
| `npm run media:cleanup` | Supprime les médias de conversation expirés |
| `npm run worker:*` | Lance un worker (`ai`, `outbound`, `billing`, `reports`) |

## Déploiement

- **Application web** : hébergée sur Vercel, déployée par l'intégration Git.
- **Workers** : les quatre workers tournent dans Docker sur un VPS ([`compose.yaml`](./compose.yaml), [`Dockerfile.worker`](./Dockerfile.worker)). Ils lisent leur configuration dans `.env.production`.
- **Preview** : chaque push sur `codex/preproduction` redéploie les workers de préproduction via [`.github/workflows/deploy-preview.yml`](./.github/workflows/deploy-preview.yml).

En production, utilisez `prisma migrate deploy` uniquement, jamais `migrate dev` ni `db push`. La procédure complète (migrations, reprise des quotas, sauvegardes) est dans [`docs/deployment.md`](./docs/deployment.md).

## Structure du projet

```
├── app/                 # Routes Next.js : site public, authentification, espace projets, API
│   ├── api/             # Webhooks (Evolution, Stripe), temps réel, notifications…
│   └── projects/        # Espace client : chat, contacts, équipe, réglages, facturation
├── components/          # Composants React (ui/ = shadcn/ui, dashboard/, website/, auth/)
├── hooks/               # Hooks React (chat, enregistrement audio, autosave…)
├── lib/                 # Logique métier : IA, Instinct, quotas, facturation, médias, rapports
├── workers/             # Workers de fond : ai, outbound, billing, reports
├── prisma/              # Schéma et migrations de la base
├── scripts/             # Scripts d'exploitation (reprise des quotas, nettoyage, déploiement)
├── tests/               # Tests unitaires, d'intégration et e2e (Playwright)
└── docs/                # Documentation technique
```

## Documentation

| Document | Sujet |
| --- | --- |
| [`docs/deployment.md`](./docs/deployment.md) | Architecture de la messagerie, migrations, conteneurs |
| [`docs/vercel-preproduction.md`](./docs/vercel-preproduction.md) | Configuration de la préproduction Vercel |
| [`docs/tests-preview.md`](./docs/tests-preview.md) | Recette sur la Preview |
| [`docs/recette.md`](./docs/recette.md) | Scénarios de recette |
| [`docs/billing-lifecycle.md`](./docs/billing-lifecycle.md) | Cycle de vie de la facturation |
| [`docs/quota-proposal.md`](./docs/quota-proposal.md) | Quotas de messages |
| [`docs/chat-media.md`](./docs/chat-media.md) | Médias dans les conversations |
| [`docs/audio-transcription.md`](./docs/audio-transcription.md) | Transcription des notes vocales |
| [`docs/image-analysis.md`](./docs/image-analysis.md) | Analyse des images |
| [`docs/settings-assistance.md`](./docs/settings-assistance.md) | Aide à la rédaction des réglages de l'agent |
| [`docs/weekly-reports.md`](./docs/weekly-reports.md) | Rapports hebdomadaires |

Les conventions de code (composants, formulaires, sécurité) sont dans [`AGENTS.md`](./AGENTS.md).

## Contact

Pour une question technique ou une demande de partenariat : [extravertyai.com/contact](https://www.extravertyai.com/contact).

<div align="center">Fait avec ❤️ par l'équipe Extraverty AI.</div>
