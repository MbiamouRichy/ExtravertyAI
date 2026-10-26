import "server-only";

import Pusher from "pusher";

let instance: Pusher | undefined;

export function getChatPusher(): Pusher {
  if (instance) return instance;

  const appId = process.env.PUSHER_APP_ID;
  const key = process.env.PUSHER_KEY;
  const secret = process.env.PUSHER_SECRET;
  const cluster = process.env.PUSHER_CLUSTER;

  if (!appId || !key || !secret || !cluster) {
    throw new Error("PUSHER_CONFIG_MISSING");
  }

  instance = new Pusher({
    appId,
    key,
    secret,
    cluster,
    useTLS: true,
  });

  return instance;
}

export function projectChatChannel(projectId: string): string {
  return `private-project-${projectId}`;
}

/**
 * Notification d'invalidation uniquement :
 * aucun texte de message, téléphone, nom ou QR code.
 *
 * Le polling SWR reste un filet de sécurité si la publication échoue.
 */
export async function notifyChatChanged(projectId: string): Promise<void> {
  try {
    await getChatPusher().trigger(
      projectChatChannel(projectId),
      "chat.changed",
      { version: 1 },
    );
  } catch {
    console.error("[realtime] Notification non publiée.");
  }
}
