"use server";

import { z } from "zod";

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth-server";
import { InstanceStatus } from "@/src/generated/prisma/client";
import { confirmInstanceConnection } from "@/lib/instance-connection";

import {
  getEvolutionConnectionState,
  getEvolutionInstanceConnect,
  logoutEvolutionInstance,
  requestEvolutionPairingCode,
} from "./evolutionAPI";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Code de liaison WhatsApp : 8 caractères alphanumériques. */
function pairingCodeOf(data: Record<string, unknown> | null | undefined) {
  const nested =
    data?.qrcode && typeof data.qrcode === "object"
      ? (data.qrcode as Record<string, unknown>).pairingCode
      : undefined;
  return [data?.pairingCode, nested]
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.replace(/[\s-]/g, "").toUpperCase())
    .find((value) => /^[A-Z0-9]{8}$/.test(value));
}

const ProjectIdSchema = z.string().cuid();

class ConnectionError extends Error {}

async function requireConnectionAdmin(projectId: string) {
  if (!ProjectIdSchema.safeParse(projectId).success) {
    throw new ConnectionError("Projet indisponible.");
  }

  const session = await getSession();

  if (!session?.user?.id) {
    throw new ConnectionError("Connexion requise.");
  }

  const membership = await prisma.projectMembership.findUnique({
    where: {
      userId_projectId: {
        userId: session.user.id,
        projectId,
      },
    },
    select: {
      role: true,
      project: {
        select: {
          id: true,
          numero: true,
          status: true,
          instanceName: true,
          instanceStatus: true,
          updatedAt: true,
        },
      },
    },
  });

  if (
    !membership ||
    (membership.role !== "OWNER" && membership.role !== "ADMIN")
  ) {
    throw new ConnectionError(
      "Vous ne pouvez pas gérer la connexion de ce projet.",
    );
  }

  if (
    membership.project.status !== "active" &&
    membership.project.status !== "trialing"
  ) {
    throw new ConnectionError("Le projet n’est pas actif.");
  }

  return membership.project;
}

function publicError(error: unknown): string {
  return error instanceof ConnectionError
    ? error.message
    : "Le service de connexion est temporairement indisponible.";
}

export async function getConnectionData(
  projectId: string,
  mode: "qr" | "phone" = "qr",
) {
  try {
    const project = await requireConnectionAdmin(projectId);

    if (project.instanceStatus === InstanceStatus.connected) {
      return {
        status: InstanceStatus.connected,
        qrCodeBase64: null,
        qrCode: null,
      };
    }

    // Liaison par code en cours : on lit l’état sans relancer de session QR,
    // sinon la passerelle invaliderait le code affiché.
    if (mode === "phone") {
      const state = await getEvolutionConnectionState(project.instanceName);
      return {
        status:
          state === "open"
            ? await confirmInstanceConnection(prisma, project)
            : state === "connecting"
              ? InstanceStatus.connecting
              : InstanceStatus.disconnected,
        qrCodeBase64: null,
        qrCode: null,
      };
    }

    const data = await getEvolutionInstanceConnect(project.instanceName);

    const rawState =
      typeof data?.instance?.state === "string"
        ? data.instance.state.toLowerCase()
        : null;

    const qr =
      typeof data?.base64 === "string" &&
      data.base64.length <= 2_000_000 &&
      /^data:image\/(?:png|jpeg);base64,[a-zA-Z0-9+/=\r\n]+$/.test(data.base64)
        ? data.base64
        : null;

    // Texte brut du QR (même secret que l’image) : permet un rendu à forte
    // correction d’erreur avec le logo au centre. Strictement validé.
    const qrCode =
      typeof data?.code === "string" &&
      data.code.length <= 1024 &&
      /^[!-~]+$/.test(data.code)
        ? data.code
        : null;

    let status: InstanceStatus = project.instanceStatus;

    if (rawState === "open") {
      status = await confirmInstanceConnection(prisma, project);
    } else if (qr) {
      status = InstanceStatus.qr_ready;
    } else if (rawState === "connecting") {
      status = InstanceStatus.connecting;
    } else if (rawState === "close") {
      status = InstanceStatus.disconnected;
    }

    // Le succès n'est annoncé qu'après synchronisation avec l'état persistant
    // utilisé par le chat. Les événements concurrents du webhook sont préservés.
    return {
      status,
      qrCodeBase64: status === InstanceStatus.connected ? null : qr,
      qrCode: status === InstanceStatus.connected ? null : qrCode,
    };
  } catch (error) {
    return {
      status: "error" as const,
      error: publicError(error),
      qrCodeBase64: null,
      qrCode: null,
    };
  }
}

export async function generatePairingCode(projectId: string) {
  try {
    const project = await requireConnectionAdmin(projectId);

    if (project.instanceStatus === InstanceStatus.connected) {
      throw new ConnectionError("WhatsApp est déjà connecté.");
    }

    const number = project.numero.replace(/\D/g, "");

    if (!/^[1-9]\d{7,14}$/.test(number)) {
      throw new ConnectionError(
        "Vérifiez le numéro international configuré pour ce projet.",
      );
    }

    // Limitation distribuée, fondée sur l'horloge PostgreSQL.
    // Une demande concurrente ne peut pas contourner ce verrou.
    const allowed = await prisma.$queryRaw<Array<{ id: string }>>`
            UPDATE "project"
            SET
                "pairingCodeRequestedAt" = clock_timestamp(),
                "updatedAt" = clock_timestamp()
            WHERE id = ${projectId}
              AND "instanceStatus" <> 'connected'
              AND status IN ('active', 'trialing')
              AND (
                  "pairingCodeRequestedAt" IS NULL
                  OR "pairingCodeRequestedAt"
                     < clock_timestamp() - interval '30 seconds'
              )
            RETURNING id
        `;

    if (allowed.length === 0) {
      throw new ConnectionError(
        "Patientez 30 secondes avant une nouvelle demande, ou vérifiez si WhatsApp est déjà connecté.",
      );
    }

    // Evolution ne crée un code que pour une session fermée : une session QR
    // en attente est d’abord fermée, puis rouverte avec le numéro.
    const state = await getEvolutionConnectionState(project.instanceName);
    if (state === "open") {
      await confirmInstanceConnection(prisma, project);
      throw new ConnectionError("WhatsApp est déjà connecté.");
    }
    if (state === "connecting") {
      await logoutEvolutionInstance(project.instanceName);
      await wait(1000);
    }

    // Le code est demandé à WhatsApp juste après l’ouverture : quelques
    // relectures courtes suffisent (la session reste alors « connecting »).
    let code: string | undefined;
    for (let attempt = 0; attempt < 4 && !code; attempt += 1) {
      if (attempt) await wait(1500);
      code = pairingCodeOf(
        await requestEvolutionPairingCode(project.instanceName, number),
      );
    }

    if (!code) {
      throw new ConnectionError(
        "Aucun code de liaison valide n’a été retourné.",
      );
    }

    return {
      success: true as const,
      pairingCode: code,
    };
  } catch (error) {
    return {
      success: false as const,
      error: publicError(error),
    };
  }
}
