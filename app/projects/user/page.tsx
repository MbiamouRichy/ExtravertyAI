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

/** Bouton d’une ligne de sécurité : pleine largeur et sur plusieurs lignes au besoin sur mobile. */
const ROW_ACTION =
  "h-auto min-h-10 w-full shrink-0 whitespace-normal text-balance sm:min-h-8 sm:w-auto";
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
        className="@container/identity relative isolate overflow-hidden rounded-3xl border bg-card p-4 sm:p-6"
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[radial-gradient(var(--border)_1px,transparent_1px)] mask-[radial-gradient(ellipse_at_top_left,black,transparent_60%)] bg-size-[18px_18px]"
        />
        {/* Suit la largeur du bloc, pas celle de l’écran : la barre latérale la
            réduit. Bloc étroit : avatar au-dessus, textes sur toute la largeur.
            Dès 20rem : avatar à gauche. Dès 48rem : actions sur la même ligne. */}
        <div className="flex flex-col gap-5 @3xl/identity:flex-row @3xl/identity:items-center @3xl/identity:justify-between">
          <div className="flex min-w-0 flex-1 flex-col items-start gap-3 @xs/identity:flex-row @xs/identity:items-center @xs/identity:gap-4">
            <Avatar className="size-14 shrink-0 @xs/identity:size-16 @lg/identity:size-20">
              <AvatarImage src={user.image || ""} alt="" />
              <AvatarFallback className="font-heading text-xl font-semibold">
                {getInitials(user.name)}
              </AvatarFallback>
            </Avatar>
            <div className="w-full min-w-0">
              <h2 className="line-clamp-2 wrap-anywhere font-heading text-xl font-bold tracking-tight @lg/identity:text-2xl">{user.name}</h2>
              <p className="wrap-anywhere text-sm text-muted-foreground">{user.email}</p>
              <Badge variant={user.emailVerified ? "secondary" : "destructive"} className="mt-2">
                {user.emailVerified ? "E-mail vérifié" : "E-mail non vérifié"}
              </Badge>
            </div>
          </div>
          {/* Pleine largeur tant que le bloc est étroit, largeur naturelle en ligne. */}
          <div className="grid shrink-0 gap-2 @md/identity:grid-cols-2 @3xl/identity:flex">
            <ModifierProfile user={user}>
              <Button variant="outline" className="min-h-10 w-full @3xl/identity:min-h-9 @3xl/identity:w-auto">
                <UserCog data-icon="inline-start" />
                Modifier le profil
              </Button>
            </ModifierProfile>
            <SignOutButton className="min-h-10 w-full @3xl/identity:min-h-9 @3xl/identity:w-auto" />
          </div>
        </div>
      </section>

      <SettingsSection
        icon={Shield}
        title="Connexion et sécurité"
        description="Les moyens d’accéder à votre compte. Modifiables dans les 10 minutes suivant une connexion."
      >
        {/* Mobile : libellé, valeur puis bouton, chacun sur toute la largeur.
            Dès sm : bouton à droite de la valeur. */}
        <ul className="divide-y rounded-2xl border bg-card">
          <li className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center sm:gap-6 sm:p-5">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-medium">
                <Mail aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                Adresse e-mail
              </p>
              <p className="mt-1 wrap-anywhere text-sm text-muted-foreground sm:truncate">{user.email}</p>
            </div>
            <RecentSessionGate
              sessionCreatedAt={sessionCreatedAt}
              callbackUrl="/projects/user"
              className={ROW_ACTION}
            >
              <ChangeEmailForm>
                <Button variant="outline" size="sm" className={ROW_ACTION}>
                  Modifier l&apos;e-mail
                </Button>
              </ChangeEmailForm>
            </RecentSessionGate>
          </li>
          <li className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center sm:gap-6 sm:p-5">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-medium">
                <Key aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                Mot de passe
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {passwordLastUpdated}
              </p>
            </div>
            <RecentSessionGate
              sessionCreatedAt={sessionCreatedAt}
              callbackUrl="/projects/user"
              className={ROW_ACTION}
            >
              <ChangePasswordDialog hasPassword={!!passwordAccount}>
                <Button variant="outline" size="sm" className={ROW_ACTION}>
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
        <RecentSessions sessions={sessions} />
      </SettingsSection>

      <UserSettingsPage
        sessionCreatedAt={sessionCreatedAt}
        email={user.email}
        deletionPlan={deletionPlan}
      />
    </main>
  );
}
