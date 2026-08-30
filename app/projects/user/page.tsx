import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { UAParser } from "ua-parser-js";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Shield, Key, Smartphone, Mail, CalendarDays, UserCog, Monitor } from "lucide-react";
import SignOutButton from "@/components/dashboard/user/signOutButton";
import { ModifierProfile } from "@/components/dashboard/user/modifierProfile";
import { getSession } from "@/lib/auth-server";
import { formatTimeAgo } from "@/lib/formatTimeAgo";
import { ChangePasswordDialog } from "@/components/dashboard/user/changePassword";
import ChangeEmailForm from "@/components/dashboard/user/modiferEmail";
import type { Metadata } from "next";
import { getInitials } from "@/components/getInitials";
import UserSettingsPage from "@/components/dashboard/user/settingsPage";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "User | ExtravertyAI",
}
export default async function ProfilePage() {
  // Récupération de la session utilisateur via Better Auth
  const sessionData = await getSession();

  if (!sessionData?.user?.id) {
    return redirect(`/sign-in?callbackUrl=/projects/user`);
  }

  const user = sessionData.user;

  // 1. Récupérer la dernière modification du mot de passe
  const passwordAccount = await prisma.account.findFirst({
    where: { userId: user.id, providerId: "credential" },
    select: { updatedAt: true },
  });
  const passwordLastUpdated = passwordAccount
    ? formatTimeAgo(passwordAccount.updatedAt)
    : "Géré par un fournisseur externe (Google/GitHub)";

  // 2. Récupérer les sessions actives
  const rawSessions = await prisma.session.findMany({
    where: { userId: user.id, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    take: 4, // Limite à 4 sessions pour éviter de surcharger l'affichage
  });

  const sessions = rawSessions.map((s) => {
    const parser = new UAParser(s.userAgent || "");
    const result = parser.getResult();

    // Formatage propre de l'IP locale
    let displayIp = s.ipAddress || "IP masquée";
    if (displayIp === "::1" || displayIp === "127.0.0.1" || displayIp.includes("0000:0000")) {
      displayIp = "Localhost (En développement)";
    }

    // NOUVEAU : Formatage de la date façon Réseaux Sociaux (ex: "21 juil. à 14:30")
    const sessionDate = new Intl.DateTimeFormat("fr-FR", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(s.createdAt));

    return {
      id: s.id,
      browser: result.browser?.name || "Navigateur inconnu",
      os: result.os?.name || "Système inconnu",
      device: result.device?.type === "mobile" ? "Mobile" : "Ordinateur",
      ip: displayIp,
      date: sessionDate, // On ajoute la date ici
    };
  });

  const joinedDate = new Date(user.createdAt).toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="max-w-5xl mx-auto p-10 md:p-12 space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Profil Utilisateur</h1>
        <p className="text-muted-foreground mt-2">
          Gérez vos informations personnelles et la sécurité de votre compte.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {/* Colonne Gauche : Identité */}
        <div className="space-y-6 lg:col-span-1">
          <Card className="border-border shadow-sm">
            <CardContent className="pt-6 flex flex-col items-center text-center">
              <div className="relative mb-4">
                <div className="absolute -inset-1 rounded-full bg-linear-to-tr from-primary/20 to-primary/0 blur-md" />
                <Avatar className="h-24 w-24 border-2 border-background relative shadow-sm">
                  <AvatarImage src={user.image || ""} alt={user.name} />
                  <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                    {getInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
              </div>

              <h2 className="text-xl font-semibold">{user.name}</h2>
              <p className="text-sm text-muted-foreground mb-4">{user.email}</p>

              <div className="w-full flex flex-col justify-between gap-2 items-center">
                <ModifierProfile user={user}>
                  <Button className="w-full cursor-pointer">
                    <UserCog className="mr-2 h-4 w-4" />
                    Modifier le profil
                  </Button>
                </ModifierProfile>
                <SignOutButton className="w-full cursor-pointer" />
              </div>
            </CardContent>
            <CardFooter className="text-sm text-muted-foreground flex items-center justify-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Membre depuis {joinedDate}
            </CardFooter>
          </Card>
        </div>

        {/* Colonne Droite : Sécurité & Sessions dynamiques */}
        <div className="space-y-6 lg:col-span-2">
          <Card className="border-border shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Shield className="h-5 w-5 text-primary" />
                Sécurité du compte
              </CardTitle>
              <CardDescription>
                Gérez vos méthodes de connexion et mots de passe.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col lg:flex-row justify-between gap-2">
                <div className="space-y-1 flex flex-col gap-2">
                  <div className="flex flex-col md:flex-row justify-between md:items-center gap-2">
                    <p className="font-medium flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      Adresse Email
                    </p>
                    <Badge className="text-sm" variant={user.emailVerified ? "default" : "destructive"}>
                      {user.emailVerified ? "Vérifiée" : "Non vérifiée"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>
                <ChangeEmailForm>
                  <Button variant="outline" size="sm">
                    Modifier l&apos;email
                  </Button>
                </ChangeEmailForm>
              </div>

              <Separator />

              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2">
                <div className="space-y-1">
                  <p className="font-medium flex items-center gap-2">
                    <Key className="h-4 w-4 text-muted-foreground" />
                    Mot de passe
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Dernière modification : {passwordLastUpdated}
                  </p>
                </div>
                <ChangePasswordDialog>
                  <Button variant="outline" size="sm">
                    Modifier le mot de passe
                  </Button>
                </ChangePasswordDialog>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Smartphone className="h-5 w-5 text-primary" />
                Connexions récentes
              </CardTitle>
              <CardDescription>
                Les appareils  récemment connectés à votre compte.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {sessions.map((s, index) => (
                <div key={s.id} className="flex flex-col lg:flex-row items-center justify-between p-4 rounded-lg border bg-card">
                  <div className="flex flex-col lg:flex-row items-center gap-4">
                    <div className="p-2 bg-primary/10 w-fit rounded-full">
                      {s.device === "Mobile" ? (
                        <Smartphone className="h-5 w-5 text-primary" />
                      ) : (
                        <Monitor className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-sm">
                        {s.device} • {s.os} - {s.browser}
                      </p>
                      {/* Affichage de l'IP et de la date ici */}
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {s.ip} • Connecté le {s.date}
                      </p>
                    </div>
                  </div>

                  {index === 0 && (
                    <Badge variant="default">Actuelle</Badge>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
          <UserSettingsPage />
        </div>
      </div>
    </div>
  );
}