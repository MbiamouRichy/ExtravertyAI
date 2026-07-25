import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { getSession } from "@/lib/auth-server";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    // 1. Récupération de la session
    const session = await getSession();

    if (!session || !session.user) {
      return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
    }

    const body = await req.json();
    const { password } = body;

    if (!password) {
      return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
    }

    // 2. CORRECTION : On cherche dans la table 'Account' au lieu de 'User'
    // On récupère le compte associé à l'ID de l'utilisateur actuel
    const account = await prisma.account.findFirst({
      where: {
        userId: session.user.id,
        // Si Better Auth utilise un providerId pour les mots de passe,
        // tu peux décommenter la ligne ci-dessous selon ta config :
        // providerId: "credential"
      },
      select: {
        password: true, // Le champ standard de Better Auth est 'password'
      },
    });

    // 3. Vérification de l'existence du mot de passe en base
    if (!account || !account.password) {
      return NextResponse.json(
        { error: "Échec de la vérification de sécurité." },
        { status: 400 },
      );
    }

    // 4. Comparaison sécurisée avec bcrypt
    const isValidPassword = await bcrypt.compare(password, account.password);

    if (!isValidPassword) {
      return NextResponse.json(
        { error: "Échec de la vérification de sécurité." },
        { status: 400 },
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Erreur verify-password:", error);
    return NextResponse.json(
      { error: "Une erreur interne est survenue." },
      { status: 500 },
    );
  }
}
