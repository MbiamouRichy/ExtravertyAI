"use client";

import { useEffect, useMemo, useState } from "react";
import { Bot } from "lucide-react";
import type { ChatGeneration, ChatMessage } from "@/lib/chat";

// A new snapshot may include older pages or delivery updates. Neither should
// replay an answer. Reset the baseline when switching conversations.
export function useLiveAiResponses(
  contactId: string | null,
  messages: ChatMessage[],
  loaded: boolean,
) {
  const [snapshot, setSnapshot] = useState<{
    contactId: string | null;
    messages: ChatMessage[] | null;
    seen: Set<string>;
    animated: Set<string>;
    latest: string;
  }>({
    contactId,
    messages: null,
    seen: new Set(),
    animated: new Set(),
    latest: "",
  });

  if (
    snapshot.contactId !== contactId ||
    (loaded && snapshot.messages !== messages)
  ) {
    const initial =
      snapshot.contactId !== contactId || snapshot.messages === null;
    const animated = initial ? new Set<string>() : new Set(snapshot.animated);
    if (!initial) {
      for (const message of messages) {
        if (
          message.senderType === "bot" &&
          !snapshot.seen.has(message.id) &&
          message.timestamp >= snapshot.latest
        )
          animated.add(message.id);
      }
    }
    setSnapshot({
      contactId,
      messages: loaded ? messages : null,
      seen: new Set(messages.map((message) => message.id)),
      animated,
      latest: messages.at(-1)?.timestamp ?? "",
    });
  }
  return snapshot.animated;
}

export function AiThinking({ generation }: { generation: ChatGeneration }) {
  const label =
    generation.state === "thinking"
      ? "Réflexion en cours…"
      : generation.state === "delayed"
        ? "La réponse prend plus de temps que prévu…"
        : "Réponse IA en préparation…";
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="flex items-center gap-3 py-3 text-sm text-muted-foreground"
    >
      <Bot aria-hidden="true" className="size-4 shrink-0" />
      <span
        className={generation.state === "delayed" ? "" : "ai-thinking-shimmer"}
      >
        {label}
      </span>
    </div>
  );
}

export function AiResponseText({
  content,
  animate,
}: {
  content: string;
  animate: boolean;
}) {
  // Keep words and whitespace intact, including emoji and multiline text.
  const words = useMemo(() => content.match(/\S+\s*|\s+/gu) ?? [], [content]);
  const [visible, setVisible] = useState(animate ? 0 : words.length);

  useEffect(() => {
    if (!animate) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let started: number | null = null;
    const duration = Math.min(4000, Math.max(500, words.length * 35));
    function finish() {
      cancelAnimationFrame(frame);
      setVisible(words.length);
    }
    function tick(now: number) {
      if (preference.matches || document.visibilityState === "hidden") {
        finish();
        return;
      }
      started ??= now;
      const count = Math.min(
        words.length,
        Math.max(1, Math.ceil(((now - started) / duration) * words.length)),
      );
      setVisible(count);
      if (count < words.length) frame = requestAnimationFrame(tick);
    }
    const onPreference = () => {
      if (preference.matches) finish();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") finish();
    };
    frame = requestAnimationFrame(tick);
    preference.addEventListener("change", onPreference);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelAnimationFrame(frame);
      preference.removeEventListener("change", onPreference);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [animate, words]);

  const revealing = animate && visible < words.length;
  return (
    <div className="text-sm leading-7 text-foreground">
      {/* Assistive technology reads the complete answer once, never each word. */}
      <p dir="auto" className="sr-only">
        {content}
      </p>
      <p
        aria-hidden="true"
        dir="auto"
        className="whitespace-pre-wrap wrap-anywhere"
      >
        {words.map((word, index) =>
          index < visible || !animate ? (
            <span
              key={index}
              className={animate ? "ai-response-word" : undefined}
            >
              {word}
            </span>
          ) : null,
        )}
        {revealing && (
          <span className="ml-1 inline-block size-1.5 animate-pulse rounded-full bg-primary align-middle motion-reduce:animate-none" />
        )}
      </p>
    </div>
  );
}
