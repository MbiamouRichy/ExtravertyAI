import type { Metadata } from "next";
<<<<<<< HEAD
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
=======
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/ui/theme-provider";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ExtravertyAI",
  description:
    "ExtravertyAI est un assistant de support client alimenté par l'IA qui fournit des réponses rapides et précises aux questions des clients, améliorant ainsi l'expérience client et le nombre de ventes.",
};

>>>>>>> 527510af029a27aa66c1e0e4bd97884e91083ab2
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
<<<<<<< HEAD
      lang="fr"
      suppressHydrationWarning
      className={cn(
        bricolageGrotesqueBricolageGrotesque.variable,
        crimsonTextCrimsonText.variable,
        robotoMonoRobotoMono.variable,
        "scroll-smooth",
      )}
    >

      <body>
=======
      lang="en"
      suppressHydrationWarning
      className={cn(
        "h-full",
        "antialiased",
        geistSans.variable,
        geistMono.variable,
        "font-sans",
        inter.variable,
      )}
    >
      <head>
        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href="/apple-touch-icon.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href="/favicon-32x32.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="16x16"
          href="/favicon-16x16.png"
        />
      </head>
      <body className="min-h-full flex flex-col">
>>>>>>> 527510af029a27aa66c1e0e4bd97884e91083ab2
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
<<<<<<< HEAD
          <Header />

=======
>>>>>>> 527510af029a27aa66c1e0e4bd97884e91083ab2
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
