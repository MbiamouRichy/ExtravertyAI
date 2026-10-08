"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AutosaveQueue,
  type AutosaveStatus,
  type SaveResult,
} from "@/lib/autosave-queue";

export function useAutosave<T>(
  version: number,
  save: (value: T, version: number) => Promise<SaveResult>,
) {
  const [state, setState] = useState<{
    status: AutosaveStatus;
    error?: string;
  }>({ status: "idle" });
  const [queue] = useState(
    () =>
      new AutosaveQueue(version, save, (status, error) => {
        setState({ status, error });
        if (status === "error")
          toast.error(error || "Enregistrement non confirmé.");
      }),
  );
  useEffect(() => {
    queue.acceptVersion(version);
  }, [queue, version]);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!queue.unsaved) return;
      void queue.flush();
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      void queue.flush();
    };
  }, [queue]);
  return { ...state, queue };
}
