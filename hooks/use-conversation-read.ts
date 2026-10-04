"use client";

import { useEffect, useRef } from "react";
import { acknowledgeConversation } from "@/app/actions/acknowledge-conversation";

export function useConversationRead({
  projectId,
  contactId,
  messageId,
  enabled,
  onRead,
}: {
  projectId: string;
  contactId: string | null;
  messageId: string | undefined;
  enabled: boolean;
  onRead: () => void;
}) {
  const marker = useRef<HTMLDivElement>(null);
  const callback = useRef(onRead);
  useEffect(() => {
    callback.current = onRead;
  }, [onRead]);
  useEffect(() => {
    const element = marker.current;
    if (!element || !contactId || !messageId || !enabled) return;
    let visible = false;
    let finished = false;
    let busy = false;
    let disposed = false;
    async function acknowledge() {
      if (
        disposed ||
        finished ||
        busy ||
        !visible ||
        document.visibilityState !== "visible" ||
        !document.hasFocus()
      )
        return;
      busy = true;
      try {
        const result = await acknowledgeConversation({
          projectId,
          contactId,
          messageId,
        });
        if (!disposed && result.success) {
          finished = true;
          callback.current();
        }
      } catch {
        // Preserve unread counts on network failure; retry while still visible.
      } finally {
        busy = false;
      }
    }
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting && entry.intersectionRatio > 0;
      void acknowledge();
    });
    observer.observe(element);
    window.addEventListener("focus", acknowledge);
    document.addEventListener("visibilitychange", acknowledge);
    const retry = window.setInterval(acknowledge, 8000);
    return () => {
      disposed = true;
      observer.disconnect();
      clearInterval(retry);
      window.removeEventListener("focus", acknowledge);
      document.removeEventListener("visibilitychange", acknowledge);
    };
  }, [projectId, contactId, messageId, enabled]);
  return marker;
}
