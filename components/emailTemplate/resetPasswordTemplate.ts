export function ResetPasswordTemplate({
  url,
  email,
}: {
  url: string;
  email: string;
}) {
  const currentYear = new Date().getFullYear();

  return `
<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Réinitialisation de votre mot de passe</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
      
      @media screen and (max-width: 600px) {
        .email-container {
          width: 100% !important;
          border-radius: 0 !important;
          border-left: none !important;
          border-right: none !important;
        }
        .email-body {
          padding: 30px 24px !important;
        }
      }
    </style>
  </head>

  <body style="margin:0; padding:0; background-color:#f9fafb; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#111827; -webkit-font-smoothing: antialiased;">
    
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb; padding:60px 0;">
      <tr>
        <td align="center">
          
          <table class="email-container" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px; background-color:#ffffff; border:1px solid #e5e7eb; border-radius:12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);">
            
            <tr>
              <td class="email-body" style="padding:40px;">
                
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="center" style="padding-bottom:32px;">
                      <a href="https://extravertyai.com" target="_blank">
                        <img 
                          src="https://extravertyai.com/logo.png" 
                          alt="ExtravertyAI"
                          width="56"
                          style="display:block; border:0; border-radius:8px;"
                        />
                      </a>
                    </td>
                  </tr>
                </table>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="center" style="font-size:24px; font-weight:600; padding-bottom:16px; color:#111827; letter-spacing:-0.02em;">
                      Réinitialisation de votre mot de passe
                    </td>
                  </tr>
                </table>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="center" style="font-size:15px; line-height:24px; color:#4b5563; padding-bottom:32px;">
                      Nous avons reçu une demande de réinitialisation de mot de passe pour le compte associé à l'adresse <strong>${email}</strong>. Cliquez sur le bouton ci-dessous pour configurer un nouveau mot de passe.
                    </td>
                  </tr>
                </table>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="center" style="padding-bottom:24px;">
                      <table role="presentation" border="0" cellspacing="0" cellpadding="0">
                        <tr>
                          <td align="center" style="border-radius:6px; background-color:#000000;">
                            <a 
                              href="${url}" 
                              target="_blank"
                              style="
                                display:inline-block;
                                padding:14px 28px;
                                font-size:15px;
                                font-weight:500;
                                background-color:#000000;
                                color:#ffffff;
                                text-decoration:none;
                                border-radius:6px;
                                border:1px solid #000000;
                              "
                            >
                              Réinitialiser mon mot de passe
                            </a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="center" style="font-size:13px; line-height:20px; color:#6b7280; padding-bottom:24px;">
                      Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :<br>
                      <a href="${url}" style="color:#111827; text-decoration:underline; word-break:break-all;">${url}</a>
                    </td>
                  </tr>
                </table>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="border-top:1px solid #e5e7eb; padding-top:24px;"></td>
                  </tr>
                </table>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="center" style="font-size:13px; line-height:20px; color:#9ca3af;">
                      Ce lien expirera dans 05 minutes pour des raisons de sécurité.<br>
                      Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email en toute sécurité. Votre mot de passe restera inchangé.
                    </td>
                  </tr>
                </table>

              </td>
            </tr>
          </table>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px; padding-top:24px;">
            <tr>
              <td align="center" style="font-size:12px; color:#9ca3af; line-height:18px;">
                &copy; ${currentYear} ExtravertyAI. Tous droits réservés.
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
