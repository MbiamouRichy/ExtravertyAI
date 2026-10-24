import type { ReactNode } from "react";

import { serifItalic } from "@/components/website/vitrine/fonts";
import { WizardTopBar } from "@/components/maquettes/project-new/wizard-chrome";

// The top bar lives in the layout so it stays put while loading.tsx streams.
export default function NewProjectMaquetteLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className={`${serifItalic.variable} flex min-h-dvh flex-col`}>
      <WizardTopBar />
      {children}
    </div>
  );
}
