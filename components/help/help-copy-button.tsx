"use client";

import { useEffect, useRef, useState } from "react";
import { Check, MessageSquareText } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

/** Copie le texte court d’une étape, mis en forme pour WhatsApp. */
export function HelpCopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Texte copié", { description: "Collez-le dans votre conversation WhatsApp." });
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copie impossible", { description: "Votre navigateur a refusé l’accès au presse-papiers." });
    }
  }

  return (
    <Button type="button" variant="ghost" size="xs" onClick={copy} aria-label={`${label} : copier le texte pour WhatsApp`}>
      {copied ? <Check /> : <MessageSquareText />}
      {copied ? "Copié" : "Copier pour WhatsApp"}
    </Button>
  );
}
