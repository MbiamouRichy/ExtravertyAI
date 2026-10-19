import type { Prisma } from "../src/generated/prisma/client";
import { planAllows } from "./plan-features";

export const INTEGRATION_EVENTS = [
  {
    id: "contact.qualified",
    label: "Prospect qualifié",
    hint: "Instinct IA repère un prospect intéressant.",
  },
  {
    id: "pipeline.stage_changed",
    label: "Étape du pipeline modifiée",
    hint: "Un prospect change d’étape (devis, gagné, perdu…).",
  },
  {
    id: "conversation.resolved",
    label: "Conversation résolue",
    hint: "Un membre marque une conversation comme traitée.",
  },
  {
    id: "conversation.assigned",
    label: "Conversation assignée",
    hint: "Une conversation est confiée à un membre.",
  },
  {
    id: "csat.received",
    label: "Note de satisfaction reçue",
    hint: "Un client répond au questionnaire.",
  },
] as const;

export type IntegrationEventId = (typeof INTEGRATION_EVENTS)[number]["id"] | "test.ping";

export const INTEGRATION_EVENT_IDS = INTEGRATION_EVENTS.map((event) => event.id) as [
  (typeof INTEGRATION_EVENTS)[number]["id"],
  ...(typeof INTEGRATION_EVENTS)[number]["id"][],
];

export type IntegrationContact = { id: string; name: string; phone: string };

/** Contact fields shared by every event: the receiving tool usually keys on the phone. */
export async function integrationContact(
  tx: Prisma.TransactionClient,
  contactId: string,
): Promise<IntegrationContact | null> {
  const contact = await tx.contact.findUnique({
    where: { id: contactId },
    select: { id: true, name: true, pushName: true, phone: true },
  });
  if (!contact) return null;
  return {
    id: contact.id,
    name: contact.name?.trim() || contact.pushName?.trim() || "Client",
    phone: contact.phone,
  };
}

/**
 * Outbox write, inside the transaction that produced the event: the delivery
 * exists if and only if the change was committed. Delivery happens later in
 * the outbound worker, never on the request path.
 */
export async function emitIntegrationEvent(
  tx: Prisma.TransactionClient,
  projectId: string,
  event: IntegrationEventId,
  data: Record<string, unknown>,
  onlyEndpointId?: string,
) {
  const project = await tx.project.findUnique({
    where: { id: projectId },
    select: { plan: true, deletionPending: true },
  });
  if (!project || project.deletionPending || !planAllows(project.plan, "integrations")) return 0;
  const endpoints = await tx.integrationEndpoint.findMany({
    where: onlyEndpointId
      ? { id: onlyEndpointId, projectId }
      : { projectId, enabled: true, events: { has: event } },
    select: { id: true },
  });
  if (!endpoints.length) return 0;
  const occurredAt = new Date().toISOString();
  await tx.integrationDelivery.createMany({
    data: endpoints.map((endpoint) => ({
      projectId,
      endpointId: endpoint.id,
      event,
      payload: { event, occurredAt, projectId, data } as Prisma.InputJsonValue,
    })),
  });
  return endpoints.length;
}
