import type { ReactNode } from "react";

import { serifItalic } from "@/components/website/vitrine/fonts";
import { MotionProvider } from "@/components/website/vitrine/motion";
import { SiteFooter } from "@/components/website/vitrine/site-footer";
import { SiteNav } from "@/components/website/vitrine/site-nav";

/**
 * Public-page frame of the Contact and À propos mockups, used by their
 * layouts so the navigation and footer stay in place while loading.tsx streams.
 */
export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <MotionProvider>
      <div className={serifItalic.variable}>
        <SiteNav />
        <main id="contenu" className="overflow-x-clip sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl sm:border-x">{children}</div>
        </main>
        <SiteFooter />
      </div>
    </MotionProvider>
  );
}
