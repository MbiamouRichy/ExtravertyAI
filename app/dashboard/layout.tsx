import { AppShell } from "@/components/app-shell";
import { getUser } from "@/lib/auth-server";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {

      const user = await getUser(); // Get the user from the server-side session
      if (!user) {
        redirect("/sign-in");
      }
    return (
        <AppShell>
            {children}
        </AppShell>
    );
}