export function ProjectMemberConfirmationEmail({
  userName,
  inviterName,
  projectName,
  role,
  projectUrl,
  email,
}: {
  userName: string;
  inviterName: string;
  projectName: string;
  role: string;
  projectUrl: string;
  email: string;
}) {
  const currentYear = new Date().getFullYear();

  // Traduction "user-friendly" du rôle pour l'email
  const roleDisplay =
    role === "ADMIN"
      ? "Administrateur"
      : role === "USER"
        ? "Utilisateur / Agent"
        : role === "OWNER"
          ? "Propriétaire"
          : role;

  return `
<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Confirmation d'ajout au projet ${projectName}</title>
    <style>
      @media screen and (max-width: 600px) {
        .email-container { width: 100% !important; margin: 0 !important; border-radius: 0 !important; border: none !important; }
        .email-body { padding: 30px 20px !important; }
        .button-link { display: block !important; width: 100% !important; text-align: center !important; box-sizing: border-box !important; }
      }
    </style>
  </head>
  <body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1f2937; -webkit-font-smoothing: antialiased;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; padding: 40px 0;">
      <tr>
        <td align="center">
          <table class="email-container" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); overflow: hidden;">
            
            <!-- Barre de statut (Succès) -->
            <tr>
              <td style="background-color: #10b981; height: 4px; width: 100%;"></td>
            </tr>

            <tr>
              <td class="email-body" style="padding: 40px 40px 30px 40px;">
                
                <!-- Logo -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding-bottom: 30px;">
                      <a href="https://extravertyai.com" target="_blank">
                        <img src="https://extravertyai.com/logo.png" alt="ExtravertyAI" width="120" style="display: block; border: 0; height: auto;" />
                      </a>
                    </td>
                  </tr>
                </table>

                <!-- Titre -->
                <h1 style="margin: 0 0 20px 0; font-size: 24px; font-weight: 700; color: #111827; letter-spacing: -0.5px;">
                  Bienvenue dans l'équipe 🎉
                </h1>

                <!-- Message -->
                <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 24px; color: #4b5563;">
                  Bonjour ${userName},
                </p>
                <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 24px; color: #4b5563;">
                  ${inviterName} vous a ajouté au projet <strong>${projectName}</strong> avec le rôle : <span style="background-color: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-weight: 500; font-size: 14px; border: 1px solid #e5e7eb;">${roleDisplay}</span>.
                </p>
                <p style="margin: 0 0 32px 0; font-size: 16px; line-height: 24px; color: #4b5563;">
                  Vous pouvez dès à présent vous connecter pour accéder à l'espace de travail, consulter les données et collaborer avec le reste de l'équipe.
                </p>

                <!-- Bouton -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding-bottom: 24px;">
                      <a class="button-link" href="${projectUrl}" style="display: inline-block; padding: 14px 28px; background-color: #111827; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; text-align: center; transition: background-color 0.2s;">
                        Accéder au tableau de bord
                      </a>
                    </td>
                  </tr>
                </table>

                <!-- Fallback URL -->
                <p style="margin: 0 0 8px 0; font-size: 14px; line-height: 20px; color: #6b7280;">
                  Le bouton ne fonctionne pas ? Copiez et collez ce lien dans votre navigateur :
                </p>
                <p style="margin: 0 0 30px 0; font-size: 14px; line-height: 20px; word-break: break-all;">
                  <a href="${projectUrl}" style="color: #2563eb; text-decoration: underline;">
                    ${projectUrl}
                  </a>
                </p>

                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 0 0 20px 0;" />

                <!-- Avertissement / Support -->
                <p style="margin: 0; font-size: 13px; line-height: 18px; color: #9ca3af;">
                  Cet email a été envoyé à ${email}. Si vous pensez qu'il s'agit d'une erreur ou si vous avez besoin d'aide, n'hésitez pas à contacter notre <a href="mailto:support@extravertyai.com" style="color: #6b7280; text-decoration: underline;">équipe de support</a>.
                </p>

              </td>
            </tr>
          </table>

          <!-- Footer -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px;">
            <tr>
              <td align="center" style="padding-top: 24px; font-size: 12px; line-height: 18px; color: #9ca3af;">
                &copy; ${currentYear} ExtravertyAI. Tous droits réservés.<br>
                Libreville, Gabon
              </td>
            </tr>
          </table>

        </td>
      </tr>
    </table>
  </body>
</html>
  `;
}
