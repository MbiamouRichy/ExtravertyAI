import type {
  PrismaClient,
  InstanceStatus,
} from "@/src/generated/prisma/client";

// Only promote a provider-confirmed connection if nothing changed while the
// request was in flight. In particular, never overwrite a newer webhook.
export async function confirmInstanceConnection(
  db: Pick<PrismaClient, "project">,
  project: {
    id: string;
    instanceName: string;
    instanceStatus: InstanceStatus;
    updatedAt: Date;
  },
): Promise<InstanceStatus> {
  const result = await db.project.updateMany({
    where: {
      id: project.id,
      instanceName: project.instanceName,
      instanceStatus: project.instanceStatus,
      updatedAt: project.updatedAt,
      status: { in: ["active", "trialing"] },
    },
    data: { instanceStatus: "connected" },
  });

  if (result.count > 0) return "connected";

  const current = await db.project.findUniqueOrThrow({
    where: { id: project.id },
    select: { instanceStatus: true },
  });
  return current.instanceStatus;
}
