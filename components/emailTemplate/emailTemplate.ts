export function EmailTemplate({ url, email }: { url: string; email: string }) {
  const currentYear = new Date().getFullYear();
  return `
<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vérification de votre adresse email</title>
    <style>
      /* Styles responsives pour mobile */
      @media screen and (max-width: 600px) {
        .email-container {
          width: 100% !important;
          margin: 0 !important;
          border-radius: 0 !important;
          border: none !important;
        }
        .email-body {
          padding: 30px 20px !important;
        }
        .button-link {
          display: block !important;
          width: 100% !important;
          text-align: center !important;
          box-sizing: border-box !important;
        }
      }
    </style>
  </head>

  <body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1f2937; -webkit-font-smoothing: antialiased;">
    
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; padding: 40px 0;">
      <tr>
        <td align="center">
          
          <!-- Conteneur principal -->
          <table class="email-container" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
            
            <tr>
              <td class="email-body" style="padding: 40px 40px 30px 40px;">
                
                <!-- Logo -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding-bottom: 30px;">
                      <a href="https://extravertyai.com" target="_blank">
                        <img 
                          src="https://extravertyai.com/logo.png" 
                          alt="ExtravertyAI"
                          width="120"
                          style="display: block; border: 0; height: auto;"
                        />
                      </a>
                    </td>
                  </tr>
                </table>

                <!-- Titre -->
                <h1 style="margin: 0 0 20px 0; font-size: 24px; font-weight: 700; color: #111827; letter-spacing: -0.5px;">
                  Vérifiez votre adresse email
                </h1>

                <!-- Message -->
                <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 24px; color: #4b5563;">
                  Bonjour,
                </p>
                <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 24px; color: #4b5563;">
                  Merci de rejoindre <strong>ExtravertyAI</strong>. Pour finaliser la création de votre compte et confirmer que <strong>${email}</strong> est bien votre adresse, veuillez cliquer sur le bouton ci-dessous :
                </p>

                <!-- Bouton -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding-bottom: 24px;">
                      <a class="button-link" href="${url}" style="display: inline-block; padding: 14px 28px; background-color: #111827; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; text-align: center;">
                        Confirmer mon email
                      </a>
                    </td>
                  </tr>
                </table>

                <!-- Fallback URL (Très important pour l'UX) -->
                <p style="margin: 0 0 8px 0; font-size: 14px; line-height: 20px; color: #6b7280;">
                  Le bouton ne fonctionne pas ? Copiez et collez ce lien dans votre navigateur :
                </p>
                <p style="margin: 0 0 30px 0; font-size: 14px; line-height: 20px; word-break: break-all;">
                  <a href="${url}" style="color: #2563eb; text-decoration: underline;">
                    ${url}
                  </a>
                </p>

                <!-- Séparateur -->
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 0 0 20px 0;" />

                <!-- Avertissement de sécurité -->
                <p style="margin: 0; font-size: 13px; line-height: 18px; color: #9ca3af;">
                  Si vous n'avez pas créé de compte sur ExtravertyAI, aucune action n'est requise de votre part. Vous pouvez ignorer cet email en toute sécurité.
                </p>

              </td>
            </tr>
          </table>

          <!-- Footer externe (Mentions légales) -->
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
