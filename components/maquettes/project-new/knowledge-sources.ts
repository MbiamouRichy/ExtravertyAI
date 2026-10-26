import { SETUP_LIMITS } from "./data";
import {
  SOURCE_URL_ERROR,
  parseSourceUrl,
  type KnowledgeSource,
} from "./schema";

// Maquette : l’analyse est simulée, aucun fichier ne quitte le navigateur.
export const PROCESSING_MS: Record<KnowledgeSource["kind"], number> = {
  pdf: 2600,
  url: 1800,
};

const CAPACITY_MESSAGE = `${SETUP_LIMITS.sources} documents maximum pendant la configuration. Vous pourrez en ajouter d’autres selon votre offre.`;

const sizeFormat = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

export function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${sizeFormat.format(Math.max(1, Math.round(bytes / 1024)))} Ko`;
  }
  return `${sizeFormat.format(bytes / (1024 * 1024))} Mo`;
}

let sequence = 0;

function nextSourceId() {
  sequence += 1;
  return `src-${Date.now().toString(36)}-${sequence}`;
}

type UrlSourceResult =
  | { ok: true; source: KnowledgeSource }
  | { ok: false; message: string };

export function createUrlSource(
  raw: string,
  existing: readonly KnowledgeSource[],
): UrlSourceResult {
  const url = parseSourceUrl(raw);
  if (!url) return { ok: false, message: SOURCE_URL_ERROR };
  if (existing.length >= SETUP_LIMITS.sources) {
    return { ok: false, message: CAPACITY_MESSAGE };
  }
  const ref = url.toString();
  if (existing.some((source) => source.ref === ref)) {
    return { ok: false, message: "Cette page est déjà ajoutée." };
  }
  return {
    ok: true,
    source: {
      id: nextSourceId(),
      kind: "url",
      label: (url.hostname + url.pathname).replace(/\/$/, "").slice(0, 200),
      detail: url.hostname,
      ref,
      addedAt: Date.now(),
    },
  };
}

/** Same check as the server (`isPdf`): the extension alone proves nothing. */
async function hasPdfSignature(file: File) {
  try {
    const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
    return String.fromCharCode(...head) === "%PDF-";
  } catch {
    return false;
  }
}

export async function createPdfSources(
  files: readonly File[],
  existing: readonly KnowledgeSource[],
) {
  const added: KnowledgeSource[] = [];
  const errors: string[] = [];

  for (const file of files) {
    const name =
      file.name.replace(/[\u0000-\u001f]/g, "").trim().slice(0, 200) ||
      "Document.pdf";
    const ref = `${name}:${file.size}:${file.lastModified}`;
    const all = [...existing, ...added];

    if (all.length >= SETUP_LIMITS.sources) {
      errors.push(CAPACITY_MESSAGE);
      break;
    }
    if (file.type !== "application/pdf" && !/\.pdf$/i.test(name)) {
      errors.push(`« ${name} » n’est pas un PDF.`);
      continue;
    }
    if (file.size === 0) {
      errors.push(`« ${name} » est vide.`);
      continue;
    }
    if (file.size > SETUP_LIMITS.pdfMaxMb * 1024 * 1024) {
      errors.push(`« ${name} » dépasse ${SETUP_LIMITS.pdfMaxMb} Mo.`);
      continue;
    }
    if (all.some((source) => source.ref === ref)) {
      errors.push(`« ${name} » est déjà ajouté.`);
      continue;
    }
    if (!(await hasPdfSignature(file))) {
      errors.push(`« ${name} » n’est pas un PDF valide.`);
      continue;
    }
    added.push({
      id: nextSourceId(),
      kind: "pdf",
      label: name,
      detail: formatBytes(file.size),
      ref,
      addedAt: Date.now(),
    });
  }

  return { added, errors };
}
