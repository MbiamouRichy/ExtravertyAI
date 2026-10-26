"use client"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { state } from "@/lib/proxy-state";
import React from "react";
import { useSnapshot } from "valtio";

export default function VerifyPage() {
  const snap = useSnapshot(state)

  return (
    <main className="w-screen h-screen flex items-center justify-center flex-col mx-auto p-2 md:p-6 space-y-4 text-white">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Veuillez vérifier votre adresse e-mail.</CardTitle>

          <CardDescription>
            Un e-mail de vérification a été envoyé à{" "}
            <a
              className="text-primary hover:underline"
              href={`mailto:${snap.email}`}
            >
              {snap.email}
            </a>
            . Rendez vous dans votre boîte de réception d{`'`}e-mail et
            cliquer sur le lien de vérification contenu dans cet e-mail.
          </CardDescription>
        </CardHeader>
      </Card>
    </main>
  );
}
