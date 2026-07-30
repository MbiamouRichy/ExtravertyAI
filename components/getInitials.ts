export const getInitials = (name: string) => {
  if (!name) return "";

  const words = name.trim().split(/\s+/); // Sépare par les espaces

  if (words.length >= 2) {
    // S'il y a au moins 2 mots, on prend la 1ère lettre des 2 premiers
    return (words[0][0] + words[1][0]).toUpperCase();
  }

  // S'il n'y a qu'un seul mot (ex: "Nickie"), on prend les 2 premières lettres
  return name.substring(0, 2).toUpperCase();
};
