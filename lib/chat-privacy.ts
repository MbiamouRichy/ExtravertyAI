/** Un numéro (ou l’identifiant chiffré d’un @lid), pas un nom. */
export function looksLikePhoneNumber(value: string) {
  return /^[+\d\s().-]{7,}$/.test(value.trim());
}

// Do not substitute private phone metadata for a display name.
export function chatContactName(contact: {
  name: string | null;
  pushName: string | null;
}) {
  for (const candidate of [contact.name, contact.pushName]) {
    const value = candidate?.trim();
    if (value && !looksLikePhoneNumber(value)) return value;
  }
  return "Contact";
}
