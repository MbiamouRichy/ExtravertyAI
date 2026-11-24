import { PRICING_PLANS } from "@/lib/pricing";
import {
  SITE_ALTERNATE_NAMES,
  SITE_CONTACT,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_SOCIAL_PROFILES,
  SITE_URL,
} from "@/lib/site";

import { OG_IMAGE } from "@/lib/seo";

const ORGANIZATION_ID = `${SITE_URL}/#organization`;
const WEBSITE_ID = `${SITE_URL}/#website`;
const SOFTWARE_ID = `${SITE_URL}/#software`;

const LOGO = {
  "@type": "ImageObject",
  url: `${SITE_URL}/android-chrome-512x512.png`,
  width: 512,
  height: 512,
};

/** Adresse absolue d’un chemin du site ; l’accueil garde son adresse canonique, sans barre finale. */
export function absoluteUrl(path: string) {
  return path === "/" ? SITE_URL : `${SITE_URL}${path}`;
}

/**
 * Données structurées schema.org de l’accueil : l’entreprise, le site et le
 * logiciel. Elles décrivent la marque et ses variantes de nom, son logo, ses
 * profils et ses offres, lues dans `lib/pricing` pour rester exactes.
 */
export function homeStructuredData() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": ORGANIZATION_ID,
        name: SITE_NAME,
        alternateName: SITE_ALTERNATE_NAMES,
        url: SITE_URL,
        logo: LOGO,
        description: SITE_DESCRIPTION,
        sameAs: SITE_SOCIAL_PROFILES,
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "customer support",
          url: SITE_CONTACT.whatsapp,
          availableLanguage: ["French"],
        },
      },
      {
        "@type": "WebSite",
        "@id": WEBSITE_ID,
        name: SITE_NAME,
        alternateName: SITE_ALTERNATE_NAMES,
        url: SITE_URL,
        inLanguage: "fr",
        publisher: { "@id": ORGANIZATION_ID },
      },
      {
        "@type": "SoftwareApplication",
        "@id": SOFTWARE_ID,
        name: SITE_NAME,
        alternateName: SITE_ALTERNATE_NAMES,
        url: SITE_URL,
        description: SITE_DESCRIPTION,
        applicationCategory: "BusinessApplication",
        applicationSubCategory: "Assistant IA pour le service client WhatsApp",
        operatingSystem: "Web",
        inLanguage: "fr",
        publisher: { "@id": ORGANIZATION_ID },
        offers: PRICING_PLANS.map((plan) => ({
          "@type": "Offer",
          name: plan.name,
          description: plan.description,
          price: (plan.priceCents / 100).toFixed(2),
          priceCurrency: "USD",
          url: `${SITE_URL}/#tarifs`,
          category: "subscription",
        })),
      },
    ],
  };
}

/**
 * Fil d’Ariane d’une page, l’accueil en tête. Google y lit la hiérarchie du
 * site et l’affiche à la place de l’adresse brute au-dessus du titre.
 */
export function breadcrumbStructuredData(trail: readonly { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [{ name: "Accueil", path: "/" }, ...trail].map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.path),
    })),
  };
}

/** Article du centre d’aide, signé et publié par l’entreprise. */
export function helpArticleStructuredData(article: {
  title: string;
  summary: string;
  path: string;
  dateModified: string;
}) {
  const url = absoluteUrl(article.path);
  const organization = { "@type": "Organization", "@id": ORGANIZATION_ID, name: SITE_NAME, url: SITE_URL, logo: LOGO };
  return {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    "@id": `${url}#article`,
    headline: article.title,
    description: article.summary,
    url,
    mainEntityOfPage: url,
    inLanguage: "fr",
    dateModified: article.dateModified,
    image: absoluteUrl(OG_IMAGE.url),
    author: organization,
    publisher: organization,
    isPartOf: { "@type": "WebSite", "@id": WEBSITE_ID, name: SITE_NAME, url: SITE_URL },
  };
}

/** Sérialise pour une balise <script> : `<` est échappé, rien ne peut fermer la balise. */
export function serializeJsonLd(data: unknown) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
