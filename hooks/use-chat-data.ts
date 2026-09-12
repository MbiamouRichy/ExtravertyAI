"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import useSWRInfinite from "swr/infinite";
import Pusher from "pusher-js";

import type { ChatClient, ChatMessage, ChatPage } from "@/lib/chat";

class ChatHttpError extends Error {
  constructor(public status: number) {
    super("Impossible de synchroniser les conversations.");
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    credentials: "same-origin",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new ChatHttpError(response.status);
  }

  return response.json() as Promise<T>;
}

const commonOptions = {
  revalidateAll: true,
  revalidateFirstPage: true,
  revalidateOnFocus: true,
  revalidateOnReconnect: true,
  refreshWhenHidden: false,
  refreshWhenOffline: false,
  dedupingInterval: 500,
  errorRetryCount: 3,
  shouldRetryOnError: (error: unknown) =>
    !(error instanceof ChatHttpError) ||
    ![400, 401, 403, 404].includes(error.status),
};

export function useDebouncedValue<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

export function useChatContacts(
  projectId: string,
  query: string,
  filter: "all" | "ai" | "manual",
) {
  const search = useDebouncedValue(query);

  const swr = useSWRInfinite<ChatPage<ChatClient>>(
    (index, previousPage) => {
      if (previousPage && !previousPage.nextCursor) return null;

      const params = new URLSearchParams({
        view: "contacts",
        q: search,
        filter,
      });

      if (index > 0 && previousPage?.nextCursor) {
        params.set("cursor", previousPage.nextCursor);
      }

      return `/api/projects/${encodeURIComponent(projectId)}/chat?${params}`;
    },
    fetchJson<ChatPage<ChatClient>>,
    {
      ...commonOptions,
      persistSize: false,
      refreshInterval: 15_000,
    },
  );

  const items = useMemo(() => {
    const byId = new Map<string, ChatClient>();

    for (const page of swr.data ?? []) {
      for (const item of page.items) {
        // La première occurrence appartient à la page la plus récente.
        if (!byId.has(item.id)) byId.set(item.id, item);
      }
    }

    return [...byId.values()];
  }, [swr.data]);

  return {
    ...swr,
    items,
    searchPending: search !== query,
    hasMore: !!swr.data?.at(-1)?.nextCursor,
    loadMore: () => swr.setSize((size) => size + 1),
  };
}

export function useChatMessages(projectId: string, contactId: string | null) {
  const swr = useSWRInfinite<ChatPage<ChatMessage>>(
    (index, previousPage) => {
      if (!contactId) return null;
      if (previousPage && !previousPage.nextCursor) return null;

      const params = new URLSearchParams({
        view: "messages",
        contactId,
      });

      if (index > 0 && previousPage?.nextCursor) {
        params.set("cursor", previousPage.nextCursor);
      }

      return `/api/projects/${encodeURIComponent(projectId)}/chat?${params}`;
    },
    fetchJson<ChatPage<ChatMessage>>,
    {
      ...commonOptions,
      persistSize: false,
      refreshInterval: 8000,
    },
  );

  const items = useMemo(() => {
    const byId = new Map<string, ChatMessage>();

    for (const page of swr.data ?? []) {
      for (const item of page.items) {
        if (!byId.has(item.id)) byId.set(item.id, item);
      }
    }

    return [...byId.values()].sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime() ||
        a.id.localeCompare(b.id),
    );
  }, [swr.data]);

  return {
    ...swr,
    items,
    hasMore: !!swr.data?.at(-1)?.nextCursor,
    loadMore: () => swr.setSize((size) => size + 1),
  };
}

export function useChatRealtime(projectId: string, onChange: () => void) {
  const callback = useRef(onChange);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    callback.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

    if (!key || !cluster) return;

    let timer: ReturnType<typeof setTimeout> | undefined;

    const pusher = new Pusher(key, {
      cluster,
      forceTLS: true,
      channelAuthorization: {
        endpoint: "/api/realtime/auth",
        transport: "ajax",
      },
    });

    const channelName = `private-project-${projectId}`;
    const channel = pusher.subscribe(channelName);

    function scheduleRefresh() {
      // Regroupement des rafales sans repousser indéfiniment le refresh.
      if (timer) return;

      timer = setTimeout(() => {
        timer = undefined;
        callback.current();
      }, 150);
    }

    function onSubscribed() {
      setConnected(true);
      scheduleRefresh();
    }

    function onDisconnected() {
      setConnected(false);
    }

    function onVisible() {
      if (document.visibilityState === "visible") {
        scheduleRefresh();
      }
    }

    channel.bind("pusher:subscription_succeeded", onSubscribed);
    channel.bind("pusher:subscription_error", onDisconnected);
    channel.bind("chat.changed", scheduleRefresh);

    pusher.connection.bind("disconnected", onDisconnected);
    pusher.connection.bind("unavailable", onDisconnected);

    document.addEventListener("visibilitychange", onVisible);

    return () => {
      if (timer) clearTimeout(timer);

      document.removeEventListener("visibilitychange", onVisible);

      channel.unbind("pusher:subscription_succeeded", onSubscribed);
      channel.unbind("pusher:subscription_error", onDisconnected);
      channel.unbind("chat.changed", scheduleRefresh);

      pusher.connection.unbind("disconnected", onDisconnected);
      pusher.connection.unbind("unavailable", onDisconnected);

      pusher.unsubscribe(channelName);
      pusher.disconnect();
    };
  }, [projectId]);

  return { connected };
}
