# Proposition de quotas de lancement

| Offre            |  Prix mensuel affiché sur le site | Messages sortants / mois proposés |
| ---------------- | --------------------------------: | --------------------------------: |
| Starter          |                       15 000 FCFA |                             1 000 |
| Pro              |                       25 000 FCFA |                             3 000 |
| Business         |                       55 000 FCFA |                            10 000 |
| Essai (10 jours) | Selon le parcours Stripe existant |                               150 |

Ces volumes sont une proposition commerciale, pas une estimation validée de marge. Une unité correspond à un message sortant admis, qu'il provienne de l'IA ou d'un agent. Les entrants n'entament pas le quota. À titre indicatif, avec cinq réponses sortantes par conversation, cela représente environ 200 / 600 / 2 000 conversations, mais ce ratio dépend de votre clientèle.

Commencer avec un plafond clair et un changement d'offre explicite. Éviter des dépassements facturés sans consentement. Avant d'augmenter les volumes, mesurer les tokens entrants/sortants, les tentatives IA, les frais éventuels de messagerie, l'hébergement et le support par client. La multimodalité, annoncée dans les offres du site, doit avoir son propre budget de coût et être implémentée avant commercialisation.

Les acteurs du secteur emploient différentes unités : [Wati](https://www.wati.io/pricing/) distingue notamment déclenchements d'automatisation et crédits IA ; [respond.io](https://respond.io/pricing) utilise les contacts actifs mensuels et des crédits IA. Ces unités ne sont pas directement comparables à un nombre de messages sortants. Les plafonds ci-dessus sont notre proposition pour vos prix existants, pas leurs quotas.

Les valeurs sont proposées dans `.env.example`, sans modification des prix Stripe ni des abonnements réels. Référence d'intégration du modèle : [API OpenRouter](https://openrouter.ai/docs/api/api-reference/chat/send-chat-completion-request).
