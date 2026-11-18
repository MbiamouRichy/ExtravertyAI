// Adresse publique et canonique du site vitrine. Elle est fixe : les
// préversions et le développement local doivent tous désigner la production
// comme version de référence auprès des moteurs de recherche.
export const SITE_URL = "https://www.extravertyai.com";

export const SITE_NAME = "ExtravertyAI";

// Les autres façons d’écrire la marque. Elles alimentent les données
// structurées : Google relie ainsi « extraverty », « extraverty ia »… au
// même site plutôt que de les traiter comme des mots inconnus.
export const SITE_ALTERNATE_NAMES = [
  "Extraverty",
  "Extraverty AI",
  "Extraverty IA",
  "ExtravertyIA",
  "IA Extraverty",
];

export const SITE_DESCRIPTION =
  "Automatisez votre support client WhatsApp avec ExtravertyAI. Réponses instantanées, augmentation des ventes et expérience client améliorée.";

export const SITE_SOCIAL = {
  facebook: "https://www.facebook.com/profile.php?id=61596607112511",
  instagram: "https://www.instagram.com/extraverty_ia",
};

export const SITE_SOCIAL_PROFILES = [SITE_SOCIAL.facebook, SITE_SOCIAL.instagram];

export const SITE_CONTACT = {
  whatsapp: "https://wa.me/24176205629",
};
