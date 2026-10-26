// Do not substitute private phone metadata for a display name.
export function chatContactName(contact: {
  name: string | null;
  pushName: string | null;
}) {
  for (const candidate of [contact.name, contact.pushName]) {
    const value = candidate?.trim();
    if (value && !/^[+\d\s().-]{7,}$/.test(value)) return value;
  }
  return "Contact";
}
