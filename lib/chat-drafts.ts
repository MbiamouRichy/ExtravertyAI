import { z } from "zod";

import { MAX_NOTE_LENGTH } from "./conversation-workflow-schema";

/**
 * Brouillons de la messagerie gardés sur l’appareil : réponse, note interne
 * et pièces jointes non envoyées, par contact. Ils survivent à la fermeture
 * de l’onglet, sont rangés par compte (un autre compte du même navigateur ne
 * les voit pas), expirent au bout de 7 jours et s’effacent à la déconnexion.
 * Rien ne part au serveur tant que l’utilisateur n’envoie pas.
 */
export const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const PREFIX = "extraverty:chat-draft:v1:";
/** Garde-fou : une saisie anormale ne remplit pas le stockage du navigateur. */
const MAX_REPLY_CHARS = 100_000;

export type ChatDraft = {
  reply: string;
  note: string;
  /** Le contact a été quitté sur une note interne en cours. */
  noteMode: boolean;
};

const StoredDraftSchema = z.object({
  reply: z.string().max(MAX_REPLY_CHARS).optional(),
  note: z.string().max(MAX_NOTE_LENGTH).optional(),
  noteMode: z.literal(true).optional(),
  at: z.number().finite(),
});

export const draftKeyPrefix = (userId: string, projectId: string) =>
  `${PREFIX}${userId}:${projectId}:`;

export const draftKey = (userId: string, projectId: string, contactId: string) =>
  `${draftKeyPrefix(userId, projectId)}${contactId}`;

/** Lu depuis le stockage, donc non fiable : validé, et ignoré s’il a expiré. */
export function parseStoredDraft(raw: string | null, now: number): ChatDraft | null {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  const parsed = StoredDraftSchema.safeParse(value);
  if (!parsed.success || now - parsed.data.at > DRAFT_TTL_MS) return null;
  const draft = {
    reply: parsed.data.reply ?? "",
    note: parsed.data.note ?? "",
    noteMode: !!parsed.data.noteMode,
  };
  return draft.reply.trim() || draft.note.trim() ? draft : null;
}

/** `null` : rien à garder, la clé est supprimée. */
export function serializeDraft(draft: ChatDraft, now: number): string | null {
  const reply = draft.reply.slice(0, MAX_REPLY_CHARS);
  const note = draft.note.slice(0, MAX_NOTE_LENGTH);
  if (!reply.trim() && !note.trim()) return null;
  return JSON.stringify({
    ...(reply.trim() ? { reply } : {}),
    ...(note.trim() ? { note } : {}),
    // Le mode note n’est rouvert que s’il reste une note à finir.
    ...(draft.noteMode && note.trim() ? { noteMode: true } : {}),
    at: now,
  });
}

function browserStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    // Stockage bloqué (navigation privée stricte, réglages du navigateur).
    return null;
  }
}

/** Brouillons d’un compte pour un projet ; les entrées expirées sont purgées. */
export function readChatDrafts(
  userId: string,
  projectId: string,
  now = Date.now(),
  storage = browserStorage(),
): Record<string, ChatDraft> {
  const drafts: Record<string, ChatDraft> = {};
  if (!storage) return drafts;
  const prefix = draftKeyPrefix(userId, projectId);
  try {
    const keys: string[] = [];
    for (let index = 0; index < storage.length; index++) {
      const key = storage.key(index);
      if (key?.startsWith(prefix)) keys.push(key);
    }
    for (const key of keys) {
      const draft = parseStoredDraft(storage.getItem(key), now);
      if (draft) drafts[key.slice(prefix.length)] = draft;
      else storage.removeItem(key);
    }
  } catch {
    // Lecture impossible : on repart d’un compositeur vide.
  }
  return drafts;
}

/** Écrit (ou supprime) le brouillon d’un contact. Renvoie la valeur gardée. */
export function writeChatDraft(
  key: string,
  draft: ChatDraft,
  now = Date.now(),
  storage = browserStorage(),
): string | null {
  const value = serializeDraft(draft, now);
  try {
    if (value) storage?.setItem(key, value);
    else storage?.removeItem(key);
  } catch {
    // Quota atteint ou stockage bloqué : le brouillon reste en mémoire.
  }
  return value;
}

type Texts = Record<string, string>;
export type DraftSnapshot = {
  replies: Texts;
  notes: Texts;
  noteModes: Record<string, true>;
};
export const EMPTY_DRAFTS: DraftSnapshot = { replies: {}, notes: {}, noteModes: {} };

/**
 * Source de vérité des brouillons d’un compte sur un projet : la mémoire,
 * recopiée dans le stockage du navigateur à chaque changement (seuls les
 * contacts modifiés sont réécrits). Lue par useSyncExternalStore.
 */
export class ChatDraftStore {
  private snapshot: DraftSnapshot | null = null;
  private listeners = new Set<() => void>();

  constructor(
    private readonly userId: string,
    private readonly projectId: string,
  ) {}

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): DraftSnapshot => {
    if (!this.snapshot) {
      const snapshot: DraftSnapshot = { replies: {}, notes: {}, noteModes: {} };
      const stored = readChatDrafts(this.userId, this.projectId);
      for (const [contactId, draft] of Object.entries(stored)) {
        if (draft.reply) snapshot.replies[contactId] = draft.reply;
        if (draft.note) snapshot.notes[contactId] = draft.note;
        if (draft.noteMode) snapshot.noteModes[contactId] = true;
      }
      this.snapshot = snapshot;
    }
    return this.snapshot;
  };

  update(change: (current: DraftSnapshot) => DraftSnapshot) {
    const previous = this.getSnapshot();
    const next = change(previous);
    if (next === previous) return;
    this.snapshot = next;
    const ids = new Set([
      ...Object.keys(previous.replies),
      ...Object.keys(next.replies),
      ...Object.keys(previous.notes),
      ...Object.keys(next.notes),
      ...Object.keys(previous.noteModes),
      ...Object.keys(next.noteModes),
    ]);
    for (const id of ids) {
      if (
        previous.replies[id] === next.replies[id] &&
        previous.notes[id] === next.notes[id] &&
        previous.noteModes[id] === next.noteModes[id]
      )
        continue;
      writeChatDraft(draftKey(this.userId, this.projectId, id), {
        reply: next.replies[id] ?? "",
        note: next.notes[id] ?? "",
        noteMode: !!next.noteModes[id],
      });
    }
    this.listeners.forEach((listener) => listener());
  }
}

const stores = new Map<string, ChatDraftStore>();
const serverStore = new ChatDraftStore("", "");

/** Une instance par compte et par projet ; aucune côté serveur. */
export function getChatDraftStore(userId: string, projectId: string) {
  if (typeof window === "undefined") return serverStore;
  const key = draftKeyPrefix(userId, projectId);
  let store = stores.get(key);
  if (!store) {
    store = new ChatDraftStore(userId, projectId);
    stores.set(key, store);
  }
  return store;
}

// Pièces jointes : fichiers gardés dans IndexedDB, puis importés à nouveau à
// la réouverture (le ticket signé d’un import n’est jamais conservé).
const DB_NAME = "extraverty-chat-drafts";
const STORE = "files";
type StoredFiles = { key: string; at: number; files: File[] };

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore(STORE, { keyPath: "key" });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | undefined> {
  const database = await openDatabase();
  if (!database) return undefined;
  return new Promise((resolve) => {
    try {
      const transaction = database.transaction(STORE, mode);
      const request = run(transaction.objectStore(STORE));
      transaction.oncomplete = () => {
        database.close();
        resolve(request ? request.result : undefined);
      };
      transaction.onerror = transaction.onabort = () => {
        database.close();
        resolve(undefined);
      };
    } catch {
      database.close();
      resolve(undefined);
    }
  });
}

// Les écritures passent l’une après l’autre : la dernière liste gagne toujours.
let fileWrites: Promise<unknown> = Promise.resolve();

export function saveDraftFiles(key: string, files: File[]) {
  fileWrites = fileWrites
    .then(() =>
      withStore("readwrite", (store) => {
        if (files.length) store.put({ key, at: Date.now(), files } satisfies StoredFiles);
        else store.delete(key);
      }),
    )
    .catch(() => undefined);
  return fileWrites;
}

export async function loadDraftFiles(key: string, now = Date.now()): Promise<File[]> {
  await fileWrites;
  const record = await withStore<StoredFiles | undefined>("readonly", (store) =>
    store.get(key),
  );
  if (!record || !Array.isArray(record.files)) return [];
  if (now - record.at > DRAFT_TTL_MS) {
    void saveDraftFiles(key, []);
    return [];
  }
  return record.files.filter((file): file is File => file instanceof File);
}

/** Déconnexion : plus aucun brouillon ne reste sur l’appareil. */
export function clearChatDrafts(storage = browserStorage()) {
  stores.clear();
  try {
    if (storage) {
      const keys: string[] = [];
      for (let index = 0; index < storage.length; index++) {
        const key = storage.key(index);
        if (key?.startsWith(PREFIX)) keys.push(key);
      }
      keys.forEach((key) => storage.removeItem(key));
    }
  } catch {
    // Stockage inaccessible : rien n’a pu y être écrit non plus.
  }
  fileWrites = fileWrites
    .then(
      () =>
        new Promise<void>((resolve) => {
          if (typeof indexedDB === "undefined") return resolve();
          try {
            const request = indexedDB.deleteDatabase(DB_NAME);
            request.onsuccess = request.onerror = request.onblocked = () =>
              resolve();
          } catch {
            resolve();
          }
        }),
    )
    .catch(() => undefined);
  return fileWrites;
}
