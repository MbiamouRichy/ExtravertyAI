import type { Metadata } from "next";

import { ChatWorkspace } from "@/components/maquettes/chat/chat-workspace";

export const metadata: Metadata = { title: "Messagerie" };

export default async function ChatMaquette({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  // Maquette : l’identifiant n’est utilisé que pour construire les liens de navigation.
  const safeId = projectId.slice(0, 64);

  return <ChatWorkspace projectId={safeId} projectName="Boutique Démo" />;
}
