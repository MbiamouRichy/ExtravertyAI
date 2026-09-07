import { AppShell } from "@/components/dashboard/app-shell";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { getUser } from "@/lib/auth-server";

export default async function ProjectsLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {

    const user = await getUser();
    const theme = user?.theme || "system"; // Récupère le thème de l'utilisateur ou utilise le thème système par défaut
    return (
        <ThemeProvider attribute="class" defaultTheme={theme} enableSystem disableTransitionOnChange>
            <AppShell>
                {children}
            </AppShell>
        </ThemeProvider>
    );
}