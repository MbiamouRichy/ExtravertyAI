import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { getSession } from "@/lib/auth-server";
import prisma from "@/lib/prisma";
import { ContactsWorkspace } from "@/components/dashboard/project/contacts-workspace";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Contacts | ExtravertyAI",
  robots: { index: false, follow: false },
};
const Query = z.object({
  q: z.string().trim().max(100).catch(""),
  filter: z.enum(["all", "ai", "human"]).catch("all"),
  page: z.coerce.number().int().min(1).max(10000).catch(1),
  sort: z.enum(["activity", "newest", "name"]).catch("activity"),
});
export default async function ContactsPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ projectId }, query] = await Promise.all([params, searchParams]);
  const session = await getSession();
  if (!session?.user?.id)
    redirect(
      `/sign-in?callbackUrl=${encodeURIComponent(`/projects/${projectId}/contacts`)}`,
    );
  const membership = await prisma.projectMembership.findUnique({
    where: { userId_projectId: { userId: session.user.id, projectId } },
    select: { role: true, project: { select: { name: true } } },
  });
  if (!membership) notFound();
  if (!["OWNER", "ADMIN"].includes(membership.role))
    redirect(`/projects/${projectId}/chat`);
  const values = Query.parse(query);
  const where = {
    projectId,
    ...(values.filter !== "all" ? { aiActive: values.filter === "ai" } : {}),
    ...(values.q
      ? {
          OR: ["name", "pushName", "phone"].map((key) => ({
            [key]: { contains: values.q, mode: "insensitive" as const },
          })),
        }
      : {}),
  };
  const [total, aiCount, filtered] = await Promise.all([
    prisma.contact.count({ where: { projectId } }),
    prisma.contact.count({ where: { projectId, aiActive: true } }),
    prisma.contact.count({ where }),
  ]);
  const pageCount = Math.max(1, Math.ceil(filtered / 20));
  const page = Math.min(values.page, pageCount);
  const contacts = await prisma.contact.findMany({
    where,
    skip: (page - 1) * 20,
    take: 20,
    orderBy:
      values.sort === "name"
        ? [{ name: "asc" }, { id: "asc" }]
        : values.sort === "newest"
          ? [{ createdAt: "desc" }, { id: "asc" }]
          : [{ lastMessageAt: { sort: "desc", nulls: "last" } }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      pushName: true,
      phone: true,
      aiActive: true,
      aiVersion: true,
      createdAt: true,
      lastMessageAt: true,
      _count: { select: { messages: true } },
      messages: {
        where: { projectId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 1,
        select: { content: true, type: true },
      },
    },
  });
  return (
    <ContactsWorkspace
      projectId={projectId}
      projectName={membership.project.name}
      total={total}
      aiCount={aiCount}
      filtered={filtered}
      page={page}
      pageCount={pageCount}
      query={values.q}
      filter={values.filter}
      sort={values.sort}
      contacts={contacts.map((c) => ({
        id: c.id,
        name: c.name,
        displayName: c.name || c.pushName || c.phone,
        phone: c.phone,
        aiActive: c.aiActive,
        aiVersion: c.aiVersion,
        createdAt: c.createdAt.toISOString(),
        lastMessageAt: c.lastMessageAt?.toISOString() || null,
        messageCount: c._count.messages,
        preview: c.messages[0]
          ? c.messages[0].type === "TEXT"
            ? c.messages[0].content.slice(0, 100)
            : `Pièce jointe · ${c.messages[0].type}`
          : "La conversation n’a pas encore commencé.",
      }))}
    />
  );
}
