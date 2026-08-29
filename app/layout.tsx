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
import { getUser } from "@/lib/auth-server";

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
  const user = await getUser()
  const userTheme = user?.theme || "system";
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
          defaultTheme={userTheme}
          enableSystem={userTheme === "system"}
          disableTransitionOnChange
        >
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster />
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
