/** Presse-papiers du compositeur : ce qu’on en lit (sous-ensemble de DataTransfer). */
type ClipboardLike = {
  readonly items?: ArrayLike<{ kind: string; getAsFile(): File | null }>;
  readonly files?: ArrayLike<File>;
  readonly types: readonly string[];
  getData(format: string): string;
};

/** Fichiers collés (captures d’écran, images copiées, fichiers du bureau). */
export function clipboardFiles(data: ClipboardLike): File[] {
  const fromItems = Array.from(data.items ?? []).flatMap((item) => {
    const file = item.kind === "file" ? item.getAsFile() : null;
    return file ? [file] : [];
  });
  return fromItems.length ? fromItems : Array.from(data.files ?? []);
}

/**
 * Word, Excel ou Google Sheets ajoutent un rendu en image au texte copié :
 * on colle alors le texte, pas l’image. Une image copiée depuis une page web
 * n’apporte qu’une balise <img>, et un fichier copié du bureau que son nom.
 */
export function clipboardPrefersText(data: ClipboardLike) {
  if (!data.getData("text/plain").trim()) return false;
  if (data.types.includes("text/rtf")) return true;
  const html = data.getData("text/html");
  if (!html) return false;
  // Sert seulement à décider : ce HTML n’est jamais affiché.
  const visibleText = html
    .replace(/<(style|script|head|title)\b[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;|\s/g, "");
  return visibleText.length > 0;
}
