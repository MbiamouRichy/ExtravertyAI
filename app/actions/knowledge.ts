"use server";

import { z } from "zod";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth-server";
import { notifyChatChanged } from "@/lib/chat-realtime";
import { SettingsError } from "@/lib/project-settings";
import {
  EntryPayloadSchema,
  KnowledgeError,
  addUrlSource,
  deleteEntry,
  deleteSource,
  importProductsCsv,
  retrySource,
  saveEntry,
  setEntryEnabled,
  sourceContent,
} from "@/lib/knowledge";
import { removeKnowledgeFile } from "@/lib/knowledge-extract";
import { KNOWLEDGE_LIMITS } from "@/lib/knowledge-shared";

type Failure = { success: false; error: string };

const Project = z.object({ projectId: z.string().cuid() });
const SaveSchema = Project.extend({ id: z.string().cuid().optional(), entry: EntryPayloadSchema });
const EntryTarget = Project.extend({ id: z.string().cuid() });
const ToggleSchema = EntryTarget.extend({ enabled: z.boolean() });
const CsvSchema = Project.extend({
  fileName: z.string().trim().min(1).max(200),
  text: z.string().max(KNOWLEDGE_LIMITS.csvMaxBytes),
});
const UrlSchema = Project.extend({ url: z.string().trim().min(1).max(2000) });
const SourceTarget = Project.extend({ sourceId: z.string().cuid() });

async function run<S extends z.ZodType, T>(
  schema: S,
  input: unknown,
  label: string,
  action: (data: z.infer<S>, userId: string) => Promise<T>,
): Promise<({ success: true } & T) | Failure> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Demande invalide." };
  }
  const session = await getSession();
  if (!session?.user?.id) return { success: false, error: "Connexion requise." };
  try {
    const result = await action(parsed.data, session.user.id);
    await notifyChatChanged((parsed.data as { projectId: string }).projectId);
    return { success: true, ...result };
  } catch (error) {
    if (error instanceof KnowledgeError || error instanceof SettingsError) {
      return { success: false, error: error.message };
    }
    console.error(`[knowledge] Échec : ${label}.`);
    return { success: false, error: `Impossible de ${label}. Réessayez.` };
  }
}

export async function saveKnowledgeEntryAction(input: z.input<typeof SaveSchema>) {
  return run(SaveSchema, input, "enregistrer l’entrée", async (data, userId) => {
    const saved = await saveEntry(prisma, { ...data, userId });
    return { id: saved.id };
  });
}

export async function setKnowledgeEntryEnabledAction(input: z.input<typeof ToggleSchema>) {
  return run(ToggleSchema, input, "modifier l’entrée", async (data, userId) => {
    await setEntryEnabled(prisma, { ...data, userId });
    return {};
  });
}

export async function deleteKnowledgeEntryAction(input: z.input<typeof EntryTarget>) {
  return run(EntryTarget, input, "supprimer l’entrée", async (data, userId) => {
    await deleteEntry(prisma, { ...data, userId });
    return {};
  });
}

export async function importProductsCsvAction(input: z.input<typeof CsvSchema>) {
  return run(CsvSchema, input, "importer le catalogue", async (data, userId) =>
    importProductsCsv(prisma, { ...data, userId }),
  );
}

export async function addKnowledgeUrlAction(input: z.input<typeof UrlSchema>) {
  return run(UrlSchema, input, "ajouter la page", async (data, userId) => {
    const source = await addUrlSource(prisma, { ...data, userId });
    return { id: source.id };
  });
}

// Lecture seule : ne déclenche aucune actualisation chez les autres membres.
export async function getKnowledgeSourceContentAction(input: z.input<typeof SourceTarget>) {
  const parsed = SourceTarget.safeParse(input);
  if (!parsed.success) return { success: false as const, error: "Demande invalide." };
  const session = await getSession();
  if (!session?.user?.id) return { success: false as const, error: "Connexion requise." };
  try {
    const passages = await sourceContent(prisma, { ...parsed.data, userId: session.user.id });
    return { success: true as const, passages };
  } catch (error) {
    if (error instanceof KnowledgeError) return { success: false as const, error: error.message };
    console.error("[knowledge] Échec : lire la source.");
    return { success: false as const, error: "Impossible d’afficher ce contenu. Réessayez." };
  }
}

export async function retryKnowledgeSourceAction(input: z.input<typeof SourceTarget>) {
  return run(SourceTarget, input, "relancer l’import", async (data, userId) => {
    await retrySource(prisma, { ...data, userId });
    return {};
  });
}

export async function deleteKnowledgeSourceAction(input: z.input<typeof SourceTarget>) {
  return run(SourceTarget, input, "supprimer la source", async (data, userId) => {
    await deleteSource(prisma, { ...data, userId }, removeKnowledgeFile);
    return {};
  });
}
