import type { ReactNode } from "react";

import { SiteShell } from "@/components/maquettes/site/site-shell";

export default function ContactMaquetteLayout({ children }: { children: ReactNode }) {
  return <SiteShell>{children}</SiteShell>;
}
