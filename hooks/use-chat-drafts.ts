"use client";

import { useCallback, useSyncExternalStore, type SetStateAction } from "react";

import {
  EMPTY_DRAFTS,
  getChatDraftStore,
  type DraftSnapshot,
} from "@/lib/chat-drafts";

type Texts = Record<string, string>;
const serverSnapshot = () => EMPTY_DRAFTS;
const noSubscription = () => () => {};

/**
 * Brouillons de réponse et de notes internes, par contact, conservés sur
 * l’appareil : fermer l’onglet ou recharger la page ne les perd plus. Même
 * forme que useState pour remplacer l’état local sans toucher aux appels.
 */
export function useChatDrafts(userId: string, projectId: string) {
  const store = getChatDraftStore(userId, projectId);
  // Rendu serveur et hydratation : vide ; le navigateur lit ensuite son stockage.
  const snapshot = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    serverSnapshot,
  );
  const restored = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );

  const updateTexts = useCallback(
    (field: "replies" | "notes", change: SetStateAction<Texts>) =>
      store.update((current: DraftSnapshot) => {
        const next =
          typeof change === "function" ? change(current[field]) : change;
        return next === current[field] ? current : { ...current, [field]: next };
      }),
    [store],
  );
  const setDrafts = useCallback(
    (change: SetStateAction<Texts>) => updateTexts("replies", change),
    [updateTexts],
  );
  const setNoteDrafts = useCallback(
    (change: SetStateAction<Texts>) => updateTexts("notes", change),
    [updateTexts],
  );
  /** Retient si le contact a été quitté en pleine note interne. */
  const setNoteMode = useCallback(
    (contactId: string, noteMode: boolean) =>
      store.update((current) => {
        if (!!current.noteModes[contactId] === noteMode) return current;
        const noteModes = { ...current.noteModes };
        if (noteMode) noteModes[contactId] = true;
        else delete noteModes[contactId];
        return { ...current, noteModes };
      }),
    [store],
  );

  return {
    drafts: snapshot.replies,
    setDrafts,
    noteDrafts: snapshot.notes,
    setNoteDrafts,
    noteModes: snapshot.noteModes,
    setNoteMode,
    restored,
  };
}
