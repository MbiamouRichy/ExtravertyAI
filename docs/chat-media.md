# Médias dans les conversations

Le chat permet de recevoir et d’envoyer des images et des fichiers audio. Les légendes des images sont conservées (1 024 caractères maximum à l’envoi). Les audios sont envoyés sans légende ; envoyer le texte dans un message distinct. Les fichiers sont limités à 4 Mo pour rester sous la limite de requête de l’hébergement Vercel, y compris après ajout des en-têtes.

Formats : JPEG, PNG, WebP, MP3, OGG, M4A, WAV, WebM. Le serveur vérifie le type, la signature du fichier et la taille. Ce contrôle n’est pas un antivirus ni un décodage intégral du fichier.

## Mise en production

- Appliquer `npm run db:deploy` (type du média dans les reçus Evolution), puis reconstruire l’application et redémarrer le worker outbound.
- Configurer les variables MinIO existantes et `BETTER_AUTH_SECRET`. Le préfixe `chat-media/` du bucket doit rester **privé**, sans politique de lecture publique. L’application et le worker doivent pouvoir lire ces objets ; l’application doit aussi pouvoir les écrire et les supprimer.
- Planifier `npm run media:cleanup` une fois par jour : supprime les imports non référencés après 25 heures, sans supprimer les médias des messages conservés. Les tickets d’import expirent après 24 heures. Ne pas appliquer de règle d’expiration globale au préfixe des médias envoyés.
- La suppression d’un projet supprime son préfixe média avant de supprimer le projet en base.
- Le worker utilise `message/sendMedia` pour les images et `message/sendWhatsAppAudio` pour les audios, avec du base64. Il ne rend aucun fichier public. Une erreur après l’appel Evolution conserve le statut incertain sans relance automatique.
- La réception utilise `chat/getBase64FromMediaMessage` avec la clé du message stockée côté serveur. Evolution doit conserver ses messages et pouvoir déchiffrer leurs médias. Aucun lien reçu dans un webhook n’est téléchargé directement.

Les médias reçus sont chargés à la demande auprès d’Evolution, sans archivage permanent dans MinIO. Un média expiré chez WhatsApp/Evolution, absent, non pris en charge ou supérieur à 4 Mo affiche une erreur avec possibilité de réessayer. Les anciens messages dont le type média n’a pas été enregistré ne sont pas reclassés automatiquement.

La compréhension des images, la transcription, la génération de médias par l’IA ne font pas partie de cette fonctionnalité. Le traitement IA existant reste textuel (texte/légendes).

## Recette avec une instance connectée

1. Envoyer une image légendée puis un vocal au numéro connecté : image et lecteur doivent apparaître après synchronisation.
2. Importer une image puis un fichier audio dans le chat : prévisualiser, retirer/remplacer et envoyer ; vérifier la réception sur le téléphone.
3. Vérifier qu’un utilisateur déconnecté ou membre d’un autre projet ne peut pas ouvrir l’URL interne du média.
4. Simuler un import échoué : erreur explicite ; aucune mise en file ni consommation du quota. Simuler une coupure après envoi : statut incertain et pas de doublon automatique.
5. Tester un audio envoyé directement depuis le téléphone associé : après rapprochement des reçus, le lecteur doit apparaître.

Contrats fournisseur : https://github.com/EvolutionAPI/evolution-api/blob/main/src/api/dto/sendMessage.dto.ts et https://github.com/EvolutionAPI/evolution-api/blob/main/src/api/dto/chat.dto.ts. Vérifier la compatibilité sur la version Evolution déployée lors de la recette.

## Enregistrement vocal

Le bouton micro enregistre au clic, après autorisation du navigateur, pendant deux minutes maximum. Arrêter ouvre une préécoute ; seul le bouton Envoyer transmet le message WhatsApp. Annuler, changer de conversation ou quitter le compositeur libère le microphone. La limite de 4 Mo et les validations serveur sont communes aux imports et aux enregistrements. Aucun son n’est enregistré automatiquement.
