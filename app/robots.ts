import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site";

// Le site vitrine est ouvert aux robots ; l’espace connecté, l’administration
// et les liens à usage unique (invitations, vérifications) ne le sont pas.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/projects",
        "/api/",
        "/maquettes",
        "/invite",
        "/verify",
        "/reset-password",
        "/forget-password",
        "/goodbye",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
