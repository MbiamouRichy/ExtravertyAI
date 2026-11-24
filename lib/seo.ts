import type { Metadata } from "next";

import { SITE_NAME } from "@/lib/site";

export const OG_IMAGE = { url: "/og-image.png", width: 1200, height: 630 } as const;

// Next fusionne les métadonnées en surface : une page qui déclare `openGraph`
// ou `twitter` remplace en entier ceux du layout. Chaque page repart donc de
// ces valeurs, pour ne perdre ni l’image ni le nom du site dans les aperçus.
export const SHARED_OPEN_GRAPH = {
  siteName: SITE_NAME,
  locale: "fr_FR",
  type: "website" as const,
  images: [OG_IMAGE],
} satisfies NonNullable<Metadata["openGraph"]>;

export const SHARED_TWITTER = {
  card: "summary_large_image" as const,
  images: [OG_IMAGE.url],
} satisfies NonNullable<Metadata["twitter"]>;

type PageSeo = {
  /** Titre de l’onglet et des résultats ; omis, celui du layout s’applique. */
  title?: string;
  /** Titre des aperçus de partage, sans le nom du site déjà donné par og:site_name. */
  shareTitle: string;
  description: string;
  /** Chemin canonique, relatif à `metadataBase`. */
  path: string;
  type?: "website" | "article";
};

/** Métadonnées d’une page publique : description, adresse canonique et aperçus de partage. */
export function pageMetadata({ title, shareTitle, description, path, type = "website" }: PageSeo): Metadata {
  return {
    ...(title ? { title } : {}),
    description,
    alternates: { canonical: path },
    openGraph: { ...SHARED_OPEN_GRAPH, type, title: shareTitle, description, url: path },
    twitter: { ...SHARED_TWITTER, title: shareTitle, description },
  };
}
