import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { UAParser } from "ua-parser-js";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, Key, Smartphone, Mail, UserCog } from "lucide-react";
import SignOutButton from "@/components/dashboard/user/signOutButton";
import { ModifierProfile } from "@/components/dashboard/user/modifierProfile";
import { getSession } from "@/lib/auth-server";
import { formatTimeAgo } from "@/lib/formatTimeAgo";
import { ChangePasswordDialog } from "@/components/dashboard/user/changePassword";
import ChangeEmailForm from "@/components/dashboard/user/modiferEmail";
import type { Metadata } from "next";
import { getInitials } from "@/components/getInitials";
import { RecentSessions } from "@/components/dashboard/user/recent-sessions";
import { RecentSessionGate } from "@/components/dashboard/user/recent-session";
import UserSettingsPage from "@/components/dashboard/user/settingsPage";
import { SettingsSection } from "@/components/dashboard/user/settings-section";
import { getAccountDeletionPlan } from "@/lib/account-deletion";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "User | ExtravertyAI",
};
export default async function ProfilePage() {
  // Récupération de la session utilisateur via Better Auth
  const sessionData = await getSession();

  if (!sessionData?.user?.id) {
    return redirect(`/sign-in?callbackUrl=/projects/user`);
  }

  const user = sessionData.user;
  const sessionCreatedAt = sessionData.session.createdAt.toISOString();

  // 1. Récupérer la dernière modification du mot de passe
  const passwordAccount = await prisma.account.findFirst({
    where: { userId: user.id, providerId: "credential" },
    select: { updatedAt: true },
  });
  const passwordLastUpdated = passwordAccount
    ? `Dernière modification : ${formatTimeAgo(passwordAccount.updatedAt)}`
    : "Aucun mot de passe : connexion via Google ou TikTok";

  const deletionPlan = await getAccountDeletionPlan(user.id);

  // 2. Récupérer les sessions actives
  const rawSessions = await prisma.session.findMany({
    where: { userId: user.id, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: { id: true, userAgent: true, country: true, createdAt: true },
  });
  const countryNames = new Intl.DisplayNames(["fr"], { type: "region" });

  const sessions = rawSessions.map((s) => {
    const parser = new UAParser(s.userAgent || "");
    const result = parser.getResult();

    // NOUVEAU : Formatage de la date façon Réseaux Sociaux (ex: "21 juil. à 14:30")
    const sessionDate = s.createdAt.toISOString();

    return {
      id: s.id,
      isCurrent: s.id === sessionData.session.id,
      browser: result.browser?.name || "Navigateur inconnu",
      os: result.os?.name || "Système inconnu",
      device: result.device?.type === "mobile" ? "Mobile" : "Ordinateur",
      country: s.country ? countryNames.of(s.country) ?? s.country : "Pays inconnu",
      date: sessionDate, // On ajoute la date ici
    };
  });

  return (
    <main className="mx-auto w-full max-w-5xl space-y-10 p-4 sm:p-6 xl:p-8">
      <header>
        <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Compte</p>
        <h1 className="mt-1 text-3xl md:text-4xl">Votre profil</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Vos informations personnelles, la sécurité de votre compte et vos préférences.
        </p>
      </header>

      <section
        aria-label="Identité"
        className="relative isolate flex flex-col gap-5 overflow-hidden rounded-3xl border bg-card p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8"
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[radial-gradient(var(--border)_1px,transparent_1px)] mask-[radial-gradient(ellipse_at_top_left,black,transparent_60%)] bg-size-[18px_18px]"
        />
        <div className="flex min-w-0 items-center gap-4">
          <Avatar className="size-16 sm:size-20">
            <AvatarImage src={user.image || ""} alt="" />
            <AvatarFallback className="font-heading text-xl font-semibold">
              {getInitials(user.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h2 className="truncate font-heading text-2xl font-bold tracking-tight">{user.name}</h2>
            <p className="truncate text-sm text-muted-foreground">{user.email}</p>
            <Badge variant={user.emailVerified ? "secondary" : "destructive"} className="mt-2">
              {user.emailVerified ? "E-mail vérifié" : "E-mail non vérifié"}
            </Badge>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <ModifierProfile user={user}>
            <Button variant="outline">
              <UserCog data-icon="inline-start" />
              Modifier le profil
            </Button>
          </ModifierProfile>
          <SignOutButton />
        </div>
      </section>

      <SettingsSection
        icon={Shield}
        title="Connexion et sécurité"
        description="Les moyens d’accéder à votre compte. Modifiables dans les 10 minutes suivant une connexion."
      >
        <ul className="divide-y rounded-2xl border bg-card">
          <li className="flex flex-col justify-between gap-3 p-5 sm:flex-row sm:items-center">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-medium">
                <Mail aria-hidden="true" className="size-4 text-muted-foreground" />
                Adresse e-mail
              </p>
              <p className="mt-1 truncate text-sm text-muted-foreground">{user.email}</p>
            </div>
            <RecentSessionGate sessionCreatedAt={sessionCreatedAt} callbackUrl="/projects/user">
              <ChangeEmailForm>
                <Button variant="outline" size="sm">Modifier l&apos;e-mail</Button>
              </ChangeEmailForm>
            </RecentSessionGate>
          </li>
          <li className="flex flex-col justify-between gap-3 p-5 sm:flex-row sm:items-center">
            <div>
              <p className="flex items-center gap-2 text-sm font-medium">
                <Key aria-hidden="true" className="size-4 text-muted-foreground" />
                Mot de passe
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {passwordLastUpdated}
              </p>
            </div>
            <RecentSessionGate sessionCreatedAt={sessionCreatedAt} callbackUrl="/projects/user">
              <ChangePasswordDialog hasPassword={!!passwordAccount}>
                <Button variant="outline" size="sm">
                  {passwordAccount ? "Modifier le mot de passe" : "Définir un mot de passe"}
                </Button>
              </ChangePasswordDialog>
            </RecentSessionGate>
          </li>
        </ul>
      </SettingsSection>

      <SettingsSection
        icon={Smartphone}
        title="Appareils connectés"
        description="Les sessions actives sur votre compte. Révoquez celles que vous ne reconnaissez pas."
      >
        <div className="rounded-2xl border bg-card p-5">
          <RecentSessions sessions={sessions} />
        </div>
      </SettingsSection>

      <UserSettingsPage
        sessionCreatedAt={sessionCreatedAt}
        email={user.email}
        deletionPlan={deletionPlan}
      />
    </main>
  );
}
