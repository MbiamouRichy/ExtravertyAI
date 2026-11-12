/**
 * Expéditeurs des e-mails d'ExtravertyAI, tous sur le domaine vérifié chez
 * Resend.
 *
 * - `NOREPLY_SENDER` : messages automatiques qui n'appellent pas de réponse
 *   (codes, mots de passe, invitations, rapports, alertes internes).
 * - `SUPPORT_SENDER` : messages auxquels un client peut vouloir répondre
 *   (facturation, suppression du compte). Une réponse arrive à support@.
 */
export const SUPPORT_EMAIL = "support@extravertyai.com";
export const NOREPLY_SENDER = "ExtravertyAI <noreply@extravertyai.com>";
export const SUPPORT_SENDER = `ExtravertyAI <${SUPPORT_EMAIL}>`;
