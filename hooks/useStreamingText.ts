import { useState, useEffect, useRef } from "react";

export function useStreamingText(incomingText: string, speedMs: number = 25) {
  const [displayedText, setDisplayedText] = useState("");
  const currentIndex = useRef(0);

  useEffect(() => {
    // Plus de setState synchrone ici !
    // On se contente de réinitialiser discrètement notre Ref (qui ne provoque pas de re-rendu).
    if (!incomingText) {
      currentIndex.current = 0;
      return;
    }

    const intervalId = setInterval(() => {
      if (currentIndex.current < incomingText.length) {
        const chunkSize = Math.floor(Math.random() * 4) + 1;

        currentIndex.current = Math.min(
          currentIndex.current + chunkSize,
          incomingText.length,
        );

        // Ce setState est asynchrone (dans le setInterval), donc React l'autorise parfaitement.
        setDisplayedText(incomingText.slice(0, currentIndex.current));
      } else {
        clearInterval(intervalId);
      }
    }, speedMs);

    return () => clearInterval(intervalId);
  }, [incomingText, speedMs]);

  // LA MAGIE EST ICI (Derived State) :
  // Si le composant parent envoie un texte vide, on renvoie une chaîne vide à la volée.
  const safeText = incomingText ? displayedText : "";

  const isFinished =
    incomingText.length > 0 && safeText.length >= incomingText.length;

  return { displayedText: safeText, isFinished };
}
