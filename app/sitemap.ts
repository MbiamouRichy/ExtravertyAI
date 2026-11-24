import type { MetadataRoute } from "next";

import { helpArticleHref } from "@/lib/help-center/articles";
import { HELP_ARTICLES, HELP_UPDATED_AT } from "@/lib/help-center/content";
import { SITE_URL } from "@/lib/site";

// Pages publiques à faire connaître aux moteurs de recherche. `/tarifs`
// n’y figure pas : elle redirige vers la section tarifs de l’accueil.
//
// `lastModified` n’est donné que lorsqu’il est exact : Google ignore la date
// d’un sitemap qui la change à chaque déploiement, page modifiée ou non.
const PAGES: Array<{
  path: string;
  changeFrequency: NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>;
  priority: number;
  lastModified?: string;
}> = [
  { path: "", changeFrequency: "weekly", priority: 1 },
  { path: "/apropos", changeFrequency: "monthly", priority: 0.8 },
  { path: "/contact", changeFrequency: "monthly", priority: 0.7 },
  { path: "/aide", changeFrequency: "weekly", priority: 0.7, lastModified: HELP_UPDATED_AT },
  ...HELP_ARTICLES.map((article) => ({
    path: helpArticleHref(article.slug),
    changeFrequency: "monthly" as const,
    priority: article.detailed ? 0.6 : 0.4,
    lastModified: HELP_UPDATED_AT,
  })),
  { path: "/sign-up", changeFrequency: "yearly", priority: 0.6 },
  { path: "/sign-in", changeFrequency: "yearly", priority: 0.5 },
  { path: "/conditions", changeFrequency: "yearly", priority: 0.3 },
  { path: "/remboursement", changeFrequency: "yearly", priority: 0.3 },
  { path: "/donneesEtConfidentialite", changeFrequency: "yearly", priority: 0.3 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map(({ path, changeFrequency, priority, lastModified }) => ({
    url: `${SITE_URL}${path}`,
    ...(lastModified ? { lastModified } : {}),
    changeFrequency,
    priority,
  }));
}
