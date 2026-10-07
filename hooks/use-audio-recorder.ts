"use client";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { MAX_MEDIA_BYTES } from "@/lib/chat-media";
export function useAudioRecorder(
  onRecorded: (file: File) => void,
  scope: string,
) {
  const [recording, setRecording] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const generation = useRef(0);
  const pending = useRef(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const callback = useRef(onRecorded);
  useEffect(() => {
    callback.current = onRecorded;
  }, [onRecorded]);
  function release() {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  }
  function cancel() {
    generation.current++;
    pending.current = false;
    if (recorder.current?.state === "recording") recorder.current.stop();
    recorder.current = null;
    release();
    setRecording(false);
    setPreparing(false);
    setSeconds(0);
  }
  useEffect(() => {
    setRecording(false);
    setPreparing(false);
    setSeconds(0);
    // This ref is an async operation generation, not a DOM ref.
    const scopeGeneration = generation;
    return () => {
      scopeGeneration.current++;
      pending.current = false;
      if (recorder.current?.state === "recording") recorder.current.stop();
      recorder.current = null;
      if (timer.current) clearInterval(timer.current);
      stream.current?.getTracks().forEach((track) => track.stop());
    };
  }, [scope]);
  async function start() {
    if (recorder.current || pending.current) return;
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      toast.error(
        "L’enregistrement est indisponible sur ce navigateur. Importez un fichier audio.",
      );
      return;
    }
    pending.current = true;
    const id = ++generation.current;
    setPreparing(true);
    try {
      const acquired = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      if (id !== generation.current) {
        acquired.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = acquired;
      const mimeType = [
        "audio/webm;codecs=opus",
        "audio/mp4",
        "audio/ogg;codecs=opus",
      ].find((type) => MediaRecorder.isTypeSupported(type));
      if (!mimeType) throw new Error("FORMAT_UNSUPPORTED");
      const instance = new MediaRecorder(acquired, {
        mimeType,
        audioBitsPerSecond: 64000,
      });
      recorder.current = instance;
      const chunks: Blob[] = [];
      let bytes = 0;
      const startedAt = Date.now();
      instance.ondataavailable = (event) => {
        if (event.data.size) {
          bytes += event.data.size;
          chunks.push(event.data);
          if (bytes > MAX_MEDIA_BYTES && instance.state === "recording")
            instance.stop();
        }
      };
      instance.onerror = () => {
        if (id === generation.current) {
          cancel();
          toast.error("L’enregistrement a été interrompu. Réessayez.");
        }
      };
      instance.onstop = () => {
        if (id !== generation.current) return;
        release();
        recorder.current = null;
        setRecording(false);
        setPreparing(false);
        if (!bytes || bytes > MAX_MEDIA_BYTES) {
          toast.error(
            bytes
              ? "L’audio dépasse 4 Mo. Enregistrez un message plus court."
              : "Aucun son enregistré.",
          );
          return;
        }
        const type = mimeType.split(";")[0];
        const extension =
          type === "audio/mp4" ? "m4a" : type === "audio/ogg" ? "ogg" : "webm";
        callback.current(
          new File(chunks, "message-vocal." + extension, { type }),
        );
      };
      instance.start(1000);
      setRecording(true);
      setSeconds(0);
      timer.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startedAt) / 1000);
        setSeconds(elapsed);
        if (elapsed >= 120 && instance.state === "recording") instance.stop();
      }, 250);
    } catch (error) {
      if (id === generation.current) {
        release();
        recorder.current = null;
        toast.error(
          error instanceof DOMException && error.name === "NotAllowedError"
            ? "Autorisez le microphone dans votre navigateur pour enregistrer un audio."
            : "Impossible d’accéder au microphone. Vous pouvez importer un fichier audio.",
        );
      }
    } finally {
      if (id === generation.current) {
        pending.current = false;
        setPreparing(false);
      }
    }
  }
  return {
    recording,
    preparing,
    seconds,
    start,
    cancel,
    stop: () => {
      if (recorder.current?.state === "recording") recorder.current.stop();
    },
  };
}
