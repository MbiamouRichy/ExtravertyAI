import type { Metadata } from "next";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/ui/theme-provider";
import {
  Bricolage_Grotesque,
  Crimson_Text,
  Roboto_Mono,
} from "next/font/google";
import { Header } from "@/components/header";

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


export const metadata: Metadata = {
  title: "ExtravertyAI - Automatisation WhatsApp & Support Client IA",
  description:
    "Automatisez votre support client WhatsApp avec ExtravertyAI. Réponses instantanées, augmentation des ventes et expérience client améliorée.",

  keywords: [
    "ExtravertyAI",
    "extravertyia",
    "extraverty ia",
    "ia libreville",
    " WhatsApp automation libreville",
    "automatisation WhatsApp pour business au Gabon",
    "bot WhatsApp",
    "automatisation WhatsApp",
    "chatbot WhatsApp",
    "marketing WhatsApp",
    "tunnel de vente automatisé",
    "automation whatsapp libreville",
    "Gabon automatisation",
    "ia gabon",
    "extraverty",
    "IA WhatsApp afrique",
    "automatisation WhatsApp",
    "chatbot IA whatsapp",
    "support client automatisé",
    "automation business",
    "intelligence artificielle entreprise",
    "bot WhatsApp gabon",
    "service client IA",
    "automatisation marketing",
    "no code automation gabon",
  ],

  authors: [{ name: "ExtravertyAI" }],

  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },

  openGraph: {
    title: "ExtravertyAI",
    description: "Automatisez votre support client sur whatsapp avec l'IA",
    url: "https://extravertyai.com",
    siteName: "ExtravertyAI",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
      },
    ],
    locale: "fr_FR",
    type: "website",
  },
};
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        bricolageGrotesqueBricolageGrotesque.variable,
        crimsonTextCrimsonText.variable,
        robotoMonoRobotoMono.variable,
        "scroll-smooth",
      )}
    >

      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Header />

          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
