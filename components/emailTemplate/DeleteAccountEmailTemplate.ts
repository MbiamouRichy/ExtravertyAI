export function DeleteAccountEmailTemplate({ url }: { url: string }) {
  const currentYear = new Date().getFullYear();

  return `
<!DOCTYPE html>
<html lang="fr" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="light dark" />
    <meta name="supported-color-schemes" content="light dark" />
    <title>Confirmation de suppression de compte</title>
    <style>
      /* Styles de base & Réinitialisation */
      body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
      table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
      img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
      
      /* Styles responsives pour mobile */
      @media screen and (max-width: 600px) {
        .email-container {
          width: 100% !important;
          margin: 0 !important;
          border-radius: 0 !important;
          border-left: none !important;
          border-right: none !important;
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

      /* DARK MODE - S'active si l'appareil de l'utilisateur est en mode sombre */
      @media (prefers-color-scheme: dark) {
        .body-bg { background-color: #171717 !important; }
        .card-bg { background-color: #262626 !important; border-color: #404040 !important; }
        .text-main { color: #f5f5f5 !important; }
        .text-muted { color: #a3a3a3 !important; }
        .btn-bg { background-color: #f5f5f5 !important; color: #171717 !important; }
        .divider { border-top-color: #404040 !important; }
        .warning-box { background-color: #450a0a !important; border-color: #7f1d1d !important; }
        .warning-title { color: #fca5a5 !important; }
        .warning-text { color: #f87171 !important; }
        .logo-img { filter: invert(1) hue-rotate(180deg); } /* Optionnel: inverse le logo si c'est un PNG noir */
      }
    </style>
  </head>

  <body class="body-bg" style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
    
    <!-- Pré-header caché (Texte d'aperçu dans la boîte de réception) -->
    <div style="display: none; max-height: 0px; overflow: hidden; color: transparent; mso-hide: all;">
      Action requise : Veuillez confirmer la suppression définitive de votre compte ExtravertyAI.
    </div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="body-bg" style="background-color: #f5f5f5; padding: 40px 0;">
      <tr>
        <td align="center">
          
          <!-- Conteneur principal -->
          <table class="email-container card-bg" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
            
            <tr>
              <td class="email-body" style="padding: 40px 40px 30px 40px;">
                
                <!-- Logo -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding-bottom: 30px;">
                      <a href="https://extravertyai.com" target="_blank">
                        <!-- Remplacez le src par l'URL absolue de votre logo -->
                        <img 
                          class="logo-img"
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
                <h1 class="text-main" style="margin: 0 0 20px 0; font-size: 24px; font-weight: 700; color: #171717; letter-spacing: -0.5px;">
                  Suppression de compte
                </h1>

                <!-- Message Principal -->
                <p class="text-muted" style="margin: 0 0 16px 0; font-size: 16px; line-height: 24px; color: #525252;">
                  Bonjour,
                </p>
                <p class="text-muted" style="margin: 0 0 24px 0; font-size: 16px; line-height: 24px; color: #525252;">
                  Nous avons bien reçu votre demande de suppression de compte sur <strong>ExtravertyAI</strong>. Avant de procéder, nous devons nous assurer que cette demande émane bien de vous.
                </p>

                <!-- Zone d'impact (Avertissement neutre) -->
                <div style="margin: 0 0 24px 0; padding-left: 14px; border-left: 3px solid #737373;">
                  <p class="text-muted" style="margin: 0; font-size: 14px; line-height: 22px; color: #525252;">
                    <strong>Attention :</strong> Cette action est définitive. Toutes vos données, configurations de bots et historiques de messages seront supprimés de manière permanente de nos serveurs.
                  </p>
                </div>

                <!-- Bouton -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding-bottom: 24px;">
                      <a class="button-link btn-bg" href="${url}" style="display: inline-block; padding: 14px 28px; background-color: #171717; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; text-align: center; transition: opacity 0.2s;">
                        Confirmer la suppression
                      </a>
                    </td>
                  </tr>
                </table>

                <!-- Fallback URL -->
                <p class="text-muted" style="margin: 0 0 8px 0; font-size: 14px; line-height: 20px; color: #737373;">
                  Si le bouton ne fonctionne pas, copiez-collez ce lien :
                </p>
                <p style="margin: 0 0 30px 0; font-size: 14px; line-height: 20px; word-break: break-all;">
                  <a href="${url}" style="color: #3b82f6; text-decoration: underline;">
                    ${url}
                  </a>
                </p>

                <!-- Séparateur -->
                <hr class="divider" style="border: none; border-top: 1px solid #e5e7eb; margin: 0 0 20px 0;" />

                <!-- Avertissement de sécurité (Zone de danger) -->
                <table class="warning-box" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px;">
                  <tr>
                    <td>
                      <p class="warning-title" style="margin: 0 0 4px 0; font-size: 14px; line-height: 20px; color: #991b1b; font-weight: 600;">
                        Vous n'avez pas demandé cette suppression ?
                      </p>
                      <p class="warning-text" style="margin: 0; font-size: 13px; line-height: 20px; color: #b91c1c;">
                        Ignorez simplement cet email. Votre compte restera actif. Si vous soupçonnez une activité suspecte, veuillez vous connecter et modifier votre mot de passe immédiatement.
                      </p>
                    </td>
                  </tr>
                </table>

              </td>
            </tr>
          </table>

          <!-- Footer externe -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px;">
            <tr>
              <td align="center" style="padding-top: 24px; font-size: 12px; line-height: 18px; color: #737373;">
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
