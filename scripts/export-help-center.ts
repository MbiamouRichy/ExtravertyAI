import { writeFile } from "node:fs/promises";
import { helpCenterToMarkdown } from "../lib/help-center/markdown";

/**
 * Régénère docs/centre-aide.md à partir de lib/help-center/content.ts.
 * Usage : npm run help:export
 *
 * Un test vérifie que le fichier suivi par Git reste à jour : relancez ce
 * script après chaque modification du contenu d’aide.
 */
const HELP_EXPORT_PATH = "docs/centre-aide.md";

async function main() {
  await writeFile(HELP_EXPORT_PATH, helpCenterToMarkdown(), "utf8");
  console.log(`Centre d’aide exporté dans ${HELP_EXPORT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
