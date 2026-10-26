import { CircleCheck, CircleHelp, Clock3, QrCode, Unplug } from "lucide-react";

const connectionStates = {
  connected: {
    label: "WhatsApp connecté",
    hint: "Connexion confirmée",
    icon: CircleCheck,
  },
  connecting: {
    label: "Connexion à confirmer",
    hint: "Ouvrez le projet pour vérifier",
    icon: Clock3,
  },
  qr_ready: {
    label: "QR code à scanner",
    hint: "Validez sur votre téléphone",
    icon: QrCode,
  },
  disconnected: {
    label: "WhatsApp déconnecté",
    hint: "Ouvrez le projet pour connecter",
    icon: Unplug,
  },
};

export function WhatsAppConnectionStatus({
  status,
}: {
  status: string | null;
}) {
  const state =
    status && Object.hasOwn(connectionStates, status)
      ? connectionStates[status as keyof typeof connectionStates]
      : {
          label: "État indisponible",
          hint: "Ouvrez le projet pour vérifier",
          icon: CircleHelp,
        };
  const Icon = state.icon;

  return (
    <div className="flex min-w-0 items-start gap-2 text-left">
      <Icon
        aria-hidden="true"
        className={`mt-0.5 size-4 shrink-0 ${status === "connected" ? "text-primary" : "text-muted-foreground"}`}
      />
      <div className="min-w-0 space-y-1">
        <p className="text-xs font-medium text-foreground">{state.label}</p>
        <p className="text-xs leading-4 text-muted-foreground">{state.hint}</p>
      </div>
    </div>
  );
}
