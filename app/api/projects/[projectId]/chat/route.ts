import { chatMediaFields } from "@/lib/chat-media";
import { currentProspectClassification } from "@/lib/instinct-classification";
import { NextResponse } from "next/server";
import { z } from "zod";

import prisma from "@/lib/prisma";
import {
  conversationUnreadCounts,
  unreadConversationCount,
} from "@/lib/conversation-reads";
import { getSession } from "@/lib/auth-server";
import {
  normalizeChatStatus,
  type ChatClient,
  type ChatPage,
  type ChatMessagesPage,
} from "@/lib/chat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

const CursorSchema = z.object({
  date: z.string().datetime(),
  id: z.string().min(1).max(200),
});

type Cursor = z.infer<typeof CursorSchema>;

const QuerySchema = z.object({
  view: z.enum(["contacts", "messages"]),
  contactId: z.string().cuid().optional(),
  cursor: z.string().max(1000).optional(),
  q: z.string().trim().max(100).default(""),
  filter: z.enum(["all", "ai", "manual"]).default("all"),
});

function encodeCursor(date: Date, id: string): string {
  return Buffer.from(
    JSON.stringify({
      date: date.toISOString(),
      id,
    }),
  ).toString("base64url");
}

function decodeCursor(value: string | undefined): Cursor | null {
  if (!value) return null;

  return CursorSchema.parse(
    JSON.parse(Buffer.from(value, "base64url").toString("utf8")),
  );
}

function json<T>(value: T, status = 200) {
  return NextResponse.json(value, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
    },
  });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const session = await getSession();

  if (!session?.user?.id) {
    return json({ error: "Connexion requise." }, 401);
  }

  if (!z.string().cuid().safeParse(projectId).success) {
    return json({ error: "Projet indisponible." }, 404);
  }

  const searchParams = new URL(request.url).searchParams;

  const parsed = QuerySchema.safeParse({
    view: searchParams.get("view"),
    contactId: searchParams.get("contactId") ?? undefined,
    cursor: searchParams.get("cursor") ?? undefined,
    q: searchParams.get("q") ?? "",
    filter: searchParams.get("filter") ?? "all",
  });

  if (!parsed.success) {
    return json({ error: "Paramètres invalides." }, 400);
  }

  let cursor: Cursor | null;

  try {
    cursor = decodeCursor(parsed.data.cursor);
  } catch {
    return json({ error: "Curseur invalide." }, 400);
  }

  try {
    const membership = await prisma.projectMembership.findUnique({
      where: {
        userId_projectId: {
          userId: session.user.id,
          projectId,
        },
      },
      select: { userId: true },
    });

    if (!membership) {
      return json({ error: "Projet indisponible." }, 404);
    }

    if (parsed.data.view === "contacts") {
      const { q, filter } = parsed.data;

      const rows = await prisma.contact.findMany({
        where: {
          projectId,
          ...(filter !== "all" ? { aiActive: filter === "ai" } : {}),
          AND: [
            ...(q
              ? [
                  {
                    OR: [
                      { name: { contains: q, mode: "insensitive" as const } },
                      {
                        pushName: { contains: q, mode: "insensitive" as const },
                      },
                      { phone: { contains: q } },
                    ],
                  },
                ]
              : []),
            ...(cursor
              ? [
                  {
                    OR: [
                      {
                        updatedAt: {
                          lt: new Date(cursor.date),
                        },
                      },
                      {
                        updatedAt: new Date(cursor.date),
                        id: { lt: cursor.id },
                      },
                    ],
                  },
                ]
              : []),
          ],
        },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: PAGE_SIZE + 1,
        select: {
          id: true,
          name: true,
          pushName: true,
          phone: true,
          aiActive: true,
          instinctClassification: true,
          instinctSourceId: true,
          instinctConfigVersion: true,
          project: {
            select: { agentConfigVersion: true, agentQualifyLeads: true },
          },
          createdAt: true,
          updatedAt: true,
          messages: {
            where: { projectId },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: 1,
            select: {
              id: true,
              content: true,
              type: true,
              createdAt: true,
            },
          },
        },
      });

      const page = rows.slice(0, PAGE_SIZE);
      const last = page.at(-1);
      const contactIds = page.map((contact) => contact.id);
      const [unreadCounts, authors, unreadConversations] = await Promise.all([
        conversationUnreadCounts(
          prisma,
          projectId,
          session.user.id,
          contactIds,
        ),
        prisma.message.findMany({
          where: {
            projectId,
            contactId: { in: contactIds },
            senderType: "AGENT",
            agentId: { not: null },
            status: { in: ["SENT", "DELIVERED", "READ"] },
          },
          distinct: ["contactId", "agentId"],
          select: {
            contactId: true,
            agent: { select: { id: true, name: true, image: true } },
          },
          orderBy: [{ agentId: "asc" }],
        }),
        unreadConversationCount(prisma, projectId, session.user.id, q, filter),
      ]);

      const result: ChatPage<ChatClient> = {
        unreadConversations,
        items: page.map((contact) => {
          const latest = contact.messages[0];
          const prospectClassification = currentProspectClassification(
            contact,
            latest?.id,
          );

          return {
            id: contact.id,
            name:
              contact.name?.trim() ||
              contact.pushName?.trim() ||
              contact.phone ||
              "Contact",
            phone: contact.phone,
            aiActive: contact.aiActive,
            prospectClassification,
            interestingProspect: prospectClassification === "interesting",
            unreadCount: unreadCounts.get(contact.id) ?? 0,
            agents: authors
              .filter((author) => author.contactId === contact.id)
              .flatMap((author) => (author.agent ? [author.agent] : [])),
            lastMessage: latest
              ? latest.type === "TEXT"
                ? latest.content
                : `Pièce jointe · ${latest.type}`
              : "Aucun message",
            lastActivityAt: (
              latest?.createdAt ?? contact.createdAt
            ).toISOString(),
          };
        }),
        nextCursor:
          rows.length > PAGE_SIZE && last
            ? encodeCursor(last.updatedAt, last.id)
            : null,
      };

      return json(result);
    }

    const contactId = parsed.data.contactId;

    if (!contactId) {
      return json({ error: "Contact requis." }, 400);
    }

    const contact = await prisma.contact.findFirst({
      where: {
        id: contactId,
        projectId,
      },
      select: {
        id: true,
        aiActive: true,
        aiVersion: true,
        messages: {
          where: { senderType: "CLIENT", fromMe: false },
          take: 1,
          select: { id: true },
        },
        project: {
          select: {
            status: true,
            automationPaused: true,
            deletionPending: true,
            agentSetupCompletedAt: true,
            agentConfigVersion: true,
          },
        },
      },
    });

    if (!contact) {
      return json({ error: "Contact indisponible." }, 404);
    }

    // Include authors from the entire authorized conversation, not just this page.
    const agents = !cursor
      ? await prisma.user.findMany({
          where: {
            messagesSent: {
              some: {
                projectId,
                contactId,
                senderType: "AGENT",
                status: { in: ["SENT", "DELIVERED", "READ"] },
              },
            },
          },
          select: { id: true, name: true, image: true },
          orderBy: [{ name: "asc" }, { id: "asc" }],
        })
      : undefined;

    // Only expose activity belonging to this authorized contact and current config.
    const generationJob =
      !cursor &&
      contact.aiActive &&
      !contact.project.automationPaused &&
      !contact.project.deletionPending &&
      contact.project.agentSetupCompletedAt &&
      ["active", "trialing"].includes(contact.project.status)
        ? await prisma.aiJob.findFirst({
            where: {
              projectId,
              contactId,
              aiVersion: contact.aiVersion,
              agentConfigVersion: contact.project.agentConfigVersion,
              state: { in: ["QUEUED", "GENERATING"] },
            },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            select: {
              id: true,
              state: true,
              createdAt: true,
              leaseUntil: true,
            },
          })
        : null;

    const rows = await prisma.message.findMany({
      where: {
        projectId,
        contactId,
        ...(cursor
          ? {
              OR: [
                {
                  createdAt: {
                    lt: new Date(cursor.date),
                  },
                },
                {
                  createdAt: new Date(cursor.date),
                  id: { lt: cursor.id },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: PAGE_SIZE + 1,
      select: {
        id: true,
        senderType: true,
        outboundJob: { select: { state: true, requestId: true } },
        agent: { select: { id: true, name: true, image: true } },
        content: true,
        type: true,
        createdAt: true,
        status: true,
      },
    });

    const page = rows.slice(0, PAGE_SIZE);
    const last = page.at(-1);

    const result: ChatMessagesPage = {
      agents,
      hasClientMessage: contact.messages.length > 0,
      generation: generationJob
        ? {
            id: generationJob.id,
            state:
              generationJob.state === "GENERATING" &&
              generationJob.leaseUntil &&
              generationJob.leaseUntil > new Date()
                ? "thinking"
                : Date.now() - generationJob.createdAt.getTime() > 120_000
                  ? "delayed"
                  : "queued",
          }
        : null,
      items: page.map((message) => ({
        id: message.id,
        agent: message.senderType === "AGENT" ? message.agent : null,
        senderType:
          message.senderType === "CLIENT"
            ? "client"
            : message.senderType === "BOT"
              ? "bot"
              : message.senderType === "AGENT"
                ? "agent"
                : "system",
        ...chatMediaFields(message, projectId),
        timestamp: message.createdAt.toISOString(),
        status: normalizeChatStatus(message.status),
        outboundState: message.outboundJob?.state ?? null,
        clientRequestId: message.outboundJob?.requestId ?? null,
      })),
      nextCursor:
        rows.length > PAGE_SIZE && last
          ? encodeCursor(last.createdAt, last.id)
          : null,
    };

    return json(result);
  } catch {
    console.error("[chat] Échec de lecture paginée.");

    return json({ error: "Impossible de charger les conversations." }, 500);
  }
}
