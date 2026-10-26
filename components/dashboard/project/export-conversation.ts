"use client";

import { toast } from "sonner";

/**
 * Télécharge la conversation : archive .zip contenant un dossier avec les
 * versions .txt et .csv. Passe par fetch pour afficher une
 * erreur claire plutôt qu’une page d’erreur si l’export est refusé.
 */
export async function downloadConversation(
  projectId: string,
  contactId: string,
) {
  const id = toast.loading("Préparation de l’export…");
  try {
    const response = await fetch(
      `/api/projects/${encodeURIComponent(projectId)}/chat/export?contactId=${encodeURIComponent(contactId)}`,
      { cache: "no-store" },
    );
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      throw new Error(body?.error || "Export indisponible. Réessayez.");
    }
    const blob = await response.blob();
    const name =
      /filename="([^"]+)"/.exec(
        response.headers.get("Content-Disposition") ?? "",
      )?.[1] ?? "conversation.zip";
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast.success("Conversation exportée", {
      id,
      description:
        "Dossier .zip avec une version .txt et une version .csv, sans numéro ni notes internes.",
    });
  } catch (error) {
    toast.error(
      error instanceof Error ? error.message : "Export indisponible. Réessayez.",
      { id },
    );
  }
}
