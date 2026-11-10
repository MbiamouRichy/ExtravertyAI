import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site";

// Pages publiques à faire connaître aux moteurs de recherche. `/tarifs`
// n’y figure pas : elle redirige vers la section tarifs de l’accueil.
const PAGES: Array<{
  path: string;
  changeFrequency: NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>;
  priority: number;
}> = [
  { path: "", changeFrequency: "weekly", priority: 1 },
  { path: "/apropos", changeFrequency: "monthly", priority: 0.8 },
  { path: "/contact", changeFrequency: "monthly", priority: 0.7 },
  { path: "/sign-up", changeFrequency: "yearly", priority: 0.6 },
  { path: "/sign-in", changeFrequency: "yearly", priority: 0.5 },
  { path: "/conditions", changeFrequency: "yearly", priority: 0.3 },
  { path: "/remboursement", changeFrequency: "yearly", priority: 0.3 },
  { path: "/donneesEtConfidentialite", changeFrequency: "yearly", priority: 0.3 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return PAGES.map(({ path, changeFrequency, priority }) => ({
    url: `${SITE_URL}${path}`,
    lastModified,
    changeFrequency,
    priority,
  }));
}
