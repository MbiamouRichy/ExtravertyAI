"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Smartphone, Copy, Check, Loader2, ArrowRight, ShieldCheck } from "lucide-react";

// Types pour gérer l'état de l'interface
type ConnectionStep = "form" | "loading" | "pairing";

export default function WhatsAppConnectCard() {
  const [step, setStep] = useState<ConnectionStep>("form");
  const [copied, setCopied] = useState(false);
  const [pairingCode, setPairingCode] = useState<string | null>(null);

  // États du formulaire
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  // Simulation de l'appel à ta Server Action (à remplacer par ta vraie fonction)
  const handleGenerateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setStep("loading");

    try {
      // ➔ ICI : Remplacer par await createWhatsAppInstance(name, phone)
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Code fictif pour l'exemple (8 caractères)
      setPairingCode("X7B9K2M4");
      setStep("pairing");
    } catch (error) {
      console.error(error);
      setStep("form");
      // Idéalement, ajouter un toast d'erreur ici
    }
  };

  const copyToClipboard = () => {
    if (pairingCode) {
      navigator.clipboard.writeText(pairingCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Formatage du code pour la lisibilité (ex: X7B9 - K2M4)
  const formatCode = (code: string) => {
    return code.match(/.{1,4}/g)?.join(" - ") || code;
  };

  return (
    <Card className="w-full max-w-md mx-auto shadow-sm border-neutral-200">
      <CardHeader className="space-y-1">
        <CardTitle className="text-xl font-semibold tracking-tight">
          Connecter un appareil
        </CardTitle>
        <CardDescription className="text-neutral-500">
          Associez votre numéro WhatsApp pour automatiser vos échanges.
        </CardDescription>
      </CardHeader>

      <CardContent>
        {/* ÉTAPE 1 : FORMULAIRE */}
        {step === "form" && (
          <form id="connect-form" onSubmit={handleGenerateCode} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-neutral-700">
                Nom de l&apos;instance
              </Label>
              <Input
                id="name"
                placeholder="Ex: Support Client - Gabon"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="bg-neutral-50/50 focus-visible:ring-neutral-400"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="text-neutral-700">
                Numéro WhatsApp
              </Label>
              <Input
                id="phone"
                type="tel"
                placeholder="241 X XX XX XX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                className="bg-neutral-50/50 focus-visible:ring-neutral-400"
              />
              <p className="text-xs text-neutral-400 flex items-center gap-1 mt-1">
                <ShieldCheck className="h-3 w-3" />
                Saisissez le numéro avec l&apos;indicatif, sans le signe +.
              </p>
            </div>
          </form>
        )}

        {/* ÉTAPE 2 : CHARGEMENT */}
        {step === "loading" && (
          <div className="py-12 flex flex-col items-center justify-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-neutral-800" />
            <div className="text-center space-y-1">
              <p className="text-sm font-medium text-neutral-700">
                Génération du code sécurisé...
              </p>
              <p className="text-xs text-neutral-500">
                Initialisation de l&apos;instance EvolutionAPI
              </p>
            </div>
          </div>
        )}

        {/* ÉTAPE 3 : AFFICHAGE DU CODE (PAIRING CODE) */}
        {step === "pairing" && pairingCode && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Zone du code */}
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-neutral-200 rounded-lg blur opacity-50"></div>
              <div className="relative bg-neutral-100 border border-neutral-200 rounded-lg p-6 flex flex-col items-center justify-center space-y-3 transition-colors hover:bg-neutral-50">
                <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  Votre code d&apos;association
                </span>
                <span className="text-3xl font-mono font-bold tracking-widest text-neutral-900">
                  {formatCode(pairingCode)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyToClipboard}
                  className="mt-2 text-neutral-600 border-neutral-300 hover:bg-neutral-200 hover:text-neutral-900 transition-all"
                >
                  {copied ? (
                    <><Check className="h-4 w-4 mr-2 text-green-600" /> Copié !</>
                  ) : (
                    <><Copy className="h-4 w-4 mr-2" /> Copier le code</>
                  )}
                </Button>
              </div>
            </div>

            {/* Instructions UX Claires */}
            <div className="bg-neutral-50 border border-neutral-100 rounded-md p-4">
              <h4 className="text-sm font-semibold text-neutral-800 flex items-center gap-2 mb-3">
                <Smartphone className="h-4 w-4" />
                Comment utiliser ce code ?
              </h4>
              <ol className="text-sm text-neutral-600 space-y-2 list-decimal list-inside marker:text-neutral-400">
                <li>Ouvrez <strong>WhatsApp</strong> sur votre téléphone.</li>
                <li>Allez dans <strong>Appareils connectés</strong>.</li>
                <li>Appuyez sur <strong>Lier un appareil</strong>.</li>
                <li>Choisissez <strong>Lier avec un numéro de téléphone</strong>.</li>
              </ol>
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-2">
        {step === "form" && (
          <Button
            type="submit"
            form="connect-form"
            className="w-full bg-neutral-900 text-white hover:bg-neutral-800 transition-colors"
          >
            Générer le code <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}

        {step === "pairing" && (
          <div className="w-full space-y-2 text-center flex flex-col">
            <Button
              variant="default"
              className="w-full bg-neutral-900 text-white hover:bg-neutral-800"
              onClick={() => {
                // Action pour fermer la modale ou rediriger vers le dashboard
                console.log("Retour au dashboard");
              }}
            >
              J&apos;ai saisi le code
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep("form")}
              className="text-neutral-500 hover:text-neutral-800"
            >
              Annuler et recommencer
            </Button>
          </div>
        )}
      </CardFooter>
    </Card>
  );
}