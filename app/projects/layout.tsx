import { AppShell } from "@/components/dashboard/app-shell";
import { ActivityTracker } from "@/components/dashboard/user/activityTracker";
import { AccountThemeSync } from "@/components/dashboard/account-theme-sync";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/auth-server";

export default async function ProjectsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getUser();
  const preferences = user
    ? await prisma.user.findUnique({
        where: { id: user.id },
        select: { theme: true },
      })
    : null;
  return (
    <>
      {user && preferences && (
        <AccountThemeSync userId={user.id} theme={preferences.theme} />
      )}
      <AppShell>{children}</AppShell>
      <ActivityTracker />
    </>
  );
}
