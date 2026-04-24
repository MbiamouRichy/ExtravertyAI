// components/PhoneMockup.tsx
import React from "react";

type PhoneMockupProps = {
  videoSrc: string;
};

export default function PhoneMockup({
  videoSrc,
}: PhoneMockupProps) {
  return (
    <div
      className={`relative w-full md:w-auto flex  items-center md:ml-auto justify-center md:justify-end`}
    >
      {/* Téléphone */}
      <div className="relative w-full aspect-9/19.5 sm:w-80 rounded-[2.5rem] border-2 border-zinc-800 bg-zinc-950 shadow-md">
        {/* Boutons latéraux */}
        <div className="absolute -left-1.5 top-2/10 h-7 w-1 rounded-l-full bg-zinc-700" />
        <div className="absolute -left-1.5 top-3/10 h-10 w-1 rounded-l-full bg-zinc-700" />
        <div className="absolute -left-1.5 top-4/10 h-10 w-1 rounded-l-full bg-zinc-700" />
        <div className="absolute -right-1.5 top-3/9 h-14 w-1 rounded-r-full bg-zinc-700" />

        {/* Écran */}
        <div className="absolute  inset-2.5 overflow-hidden rounded-[2rem] bg-black">
          <video
            className="h-full w-full aspect-9/16 object-cover"
            src={videoSrc}
            autoPlay
            muted
            loop
            playsInline
          />

          {/* Optionnel : léger overlay pour un look plus clean */}
          <div className="pointer-events-none absolute inset-0 bg-muted/10" />
        </div>

        {/* Barre home */}
        <div className="absolute bottom-5 left-1/2 h-2 w-20 -translate-x-1/2 rounded-full bg-zinc-600" />
      </div>
    </div>
  );
}
