"use client";

import { useRouter } from "next/navigation";
import { useCallback, useTransition } from "react";

import { useChatRealtime } from "@/hooks/use-chat-data";
import { BroadcastActions } from "./broadcast-actions";
import type { BroadcastStatus } from "./types";

/** Keeps a broadcast page current while it sends, and offers its actions. */
export function BroadcastLive({
  projectId,
  broadcastId,
  name,
  status,
  pending,
  canManage,
}: {
  projectId: string;
  broadcastId: string;
  name: string;
  status: BroadcastStatus;
  pending: number;
  canManage: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const refresh = useCallback(() => startTransition(() => router.refresh()), [router]);
  useChatRealtime(projectId, refresh);
  if (!canManage) return null;
  return (
    <BroadcastActions
      projectId={projectId}
      broadcastId={broadcastId}
      name={name}
      status={status}
      pending={pending}
      onChanged={refresh}
    />
  );
}
