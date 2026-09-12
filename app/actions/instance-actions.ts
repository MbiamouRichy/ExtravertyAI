"use server";

import { z } from "zod";

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth-server";
import { InstanceStatus } from "@/src/generated/prisma/client";

import {
  getEvolutionInstanceConnect,
  requestEvolutionPairingCode,
} from "./evolutionAPI";

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

export async function getConnectionData(projectId: string) {
  try {
    const project = await requireConnectionAdmin(projectId);

    if (project.instanceStatus === InstanceStatus.connected) {
      return {
        status: InstanceStatus.connected,
        qrCodeBase64: null,
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

    let status: InstanceStatus = project.instanceStatus;

    if (rawState === "open") {
      status = InstanceStatus.connected;
    } else if (qr) {
      status = InstanceStatus.qr_ready;
    } else if (rawState === "connecting") {
      status = InstanceStatus.connecting;
    } else if (rawState === "close") {
      status = InstanceStatus.disconnected;
    }

    // Le webhook doit rester l'autorité principale pour la persistance
    // de l'état : une réponse API ancienne ne doit pas écraser un
    // événement de connexion plus récent.
    return {
      status,
      qrCodeBase64: status === InstanceStatus.connected ? null : qr,
    };
  } catch (error) {
    return {
      status: "error" as const,
      error: publicError(error),
      qrCodeBase64: null,
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

    const data = await requestEvolutionPairingCode(
      project.instanceName,
      number,
    );

    // Hypothèse héritée de ton intégration actuelle :
    // code de liaison alphanumérique de 8 caractères.
    // À confirmer sur la version Evolution installée.
    const candidates = [data?.pairingCode, data?.code];

    const code = candidates
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.replace(/[\s-]/g, "").toUpperCase())
      .find((value) => /^[A-Z0-9]{8}$/.test(value));

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
