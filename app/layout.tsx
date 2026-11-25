import "./globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/ui/theme-provider";
import {
  Bricolage_Grotesque,
  Crimson_Text,
  Roboto_Mono,
} from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SiteAnalyticsBeacon } from "@/components/site-analytics-beacon";
import { MetaPixel } from "@/components/meta-pixel";
import type { Metadata } from "next";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import { SHARED_OPEN_GRAPH, SHARED_TWITTER } from "@/lib/seo";

// Valeurs communes à tout le site. `metadataBase` rend absolues les URL
// relatives (balises canoniques, images Open Graph) de chaque page.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  description: SITE_DESCRIPTION,
  icons: {
    // Google veut une icône d’au moins 48 px : la PNG 192 px lui en donne une
    // nette, en plus du favicon.ico que Next déclare de lui-même.
    icon: [
      { url: "/android-chrome-192x192.png", type: "image/png", sizes: "192x192" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: SHARED_OPEN_GRAPH,
  twitter: SHARED_TWITTER,
  // Codes de validation de Google Search Console et Bing Webmaster Tools,
  // fournis par variables d’environnement ; absents, aucune balise n’est émise.
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
    other: process.env.BING_SITE_VERIFICATION
      ? { "msvalidate.01": process.env.BING_SITE_VERIFICATION }
      : undefined,
  },
};

const robotoMonoRobotoMono = Roboto_Mono({
  subsets: [
    "cyrillic",
    "cyrillic-ext",
    "greek",
    "latin",
    "latin-ext",
    "vietnamese",
  ],
  weight: ["100", "200", "300", "400", "500", "600", "700"],
  variable: "--font-roboto-mono",
});

const crimsonTextCrimsonText = Crimson_Text({
  subsets: ["latin", "latin-ext", "vietnamese"],
  weight: ["400", "600", "700"],
  variable: "--font-crimson-text",
});

const bricolageGrotesqueBricolageGrotesque = Bricolage_Grotesque({
  subsets: ["latin", "latin-ext", "vietnamese"],
  weight: ["200", "300", "400", "500", "600", "700", "800"],
  variable: "--font-bricolage-grotesque",
});



export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  return (
    <html
      lang="fr"
      suppressHydrationWarning
      className={cn(
        bricolageGrotesqueBricolageGrotesque.variable,
        crimsonTextCrimsonText.variable,
        robotoMonoRobotoMono.variable,
      )}
      data-scroll-behavior="smooth"
    >

      <body suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster />
        </ThemeProvider>
        {/* Vercel Analytics n'existe que sur Vercel : hors Vercel (VPS), son
            script répondrait 404 à chaque page. Le compteur maison reste. */}
        {process.env.VERCEL && <Analytics />}
        <SiteAnalyticsBeacon />
        <MetaPixel />
      </body>
    </html>
  );
}
