import { NextResponse } from "next/server";
import { can } from "@/lib/project-permissions";
import { z } from "zod";

import { getSession } from "@/lib/auth-server";
import prisma from "@/lib/prisma";
import { chatContactName } from "@/lib/chat-privacy";
import { csvCell } from "@/lib/export-csv";
import { getUserTimeZone } from "@/lib/server-time-zone";

export const runtime = "nodejs";

// Garde-fou : une conversation WhatsApp dépasse rarement ce volume.
const MAX_MESSAGES = 20000;

const AUTHOR = { CLIENT: "Client", BOT: "Assistant IA", AGENT: "Équipe" } as const;
const TYPE = {
  TEXT: "Texte",
  IMAGE: "Image",
  AUDIO: "Audio",
  VIDEO: "Vidéo",
  DOCUMENT: "Document",
} as const;

function error(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "private, no-store" } },
  );
}

/** Nom de fichier ASCII sûr, sans donnée de contact sensible. */
function fileSlug(value: string) {
  const slug = value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 40);
  return slug || "contact";
}

/**
 * Export d’une conversation (archive .zip : dossier avec une version .txt
 * lisible et une version .csv), réservé aux membres du projet (qui la lisent
 * déjà dans la messagerie). Le numéro de téléphone et les notes internes ne
 * sont pas exportés.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const contactId = new URL(request.url).searchParams.get("contactId") ?? "";

  const session = await getSession();
  if (!session?.user?.id) return error("Connexion requise.", 401);
  if (
    !z.string().cuid().safeParse(projectId).success ||
    !z.string().cuid().safeParse(contactId).success
  )
    return error("Conversation introuvable.", 404);

  try {
    const membership = await prisma.projectMembership.findUnique({
      where: { userId_projectId: { userId: session.user.id, projectId } },
      select: { role: true, project: { select: { deletionPending: true } } },
    });
    if (
      !membership ||
      membership.project.deletionPending ||
      !can(membership.role, "conversations.handle")
    )
      return error("Conversation introuvable.", 404);

    // Le contact doit appartenir à ce projet (isolation entre projets).
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, projectId },
      select: { name: true, pushName: true },
    });
    if (!contact) return error("Conversation introuvable.", 404);

    const messages = await prisma.message.findMany({
      where: { projectId, contactId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: MAX_MESSAGES,
      select: {
        createdAt: true,
        senderType: true,
        type: true,
        content: true,
        extractedText: true,
        extractionStatus: true,
        agent: { select: { name: true } },
      },
    });

    const timeZone = await getUserTimeZone();
    const date = new Intl.DateTimeFormat("fr-FR", {
      timeZone,
      dateStyle: "short",
      timeStyle: "medium",
    });
    const contactName = chatContactName(contact);

    const header = [
      `Date (${timeZone})`,
      "Auteur",
      "Membre",
      "Type",
      "Message",
      "Transcription / analyse IA",
    ];
    const rows = messages.map((message) => {
      const media = message.type !== "TEXT";
      const placeholder = message.content === `[${message.type}]`;
      return [
        date.format(message.createdAt),
        message.senderType === "CLIENT"
          ? contactName
          : AUTHOR[message.senderType],
        message.senderType === "AGENT" ? message.agent?.name?.trim() || "" : "",
        TYPE[message.type as keyof typeof TYPE] ?? message.type,
        media && placeholder ? "" : message.content,
        message.extractionStatus === "COMPLETED"
          ? message.extractedText ?? ""
          : "",
      ];
    });

    const csv =
      "﻿" +
      [header, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n");

    // Version lisible : un bloc par message, transcription indentée dessous.
    const COL = { date: 0, author: 1, member: 2, type: 3, content: 4, insight: 5 };
    const txt = [
      `Conversation avec ${contactName}`,
      `Exportée le ${date.format(new Date())} (${timeZone}) · ${rows.length} message${rows.length > 1 ? "s" : ""}`,
      "Le numéro de téléphone et les notes internes ne sont pas inclus.",
      "─".repeat(48),
      ...rows.map((row) => {
        const who = row[COL.member]
          ? `${row[COL.author]} (${row[COL.member]})`
          : row[COL.author];
        const media = row[COL.type] !== TYPE.TEXT;
        return [
          `[${row[COL.date]}] ${who}${media && row[COL.content] ? ` · ${row[COL.type]}` : ""}`,
          row[COL.content] || `[${row[COL.type]}]`,
          ...(row[COL.insight]
            ? [`  ↳ Transcription / analyse IA : ${row[COL.insight]}`]
            : []),
        ].join("\n");
      }),
    ].join("\n\n");

    // Un dossier, deux formats : .txt à lire, .csv pour un tableur.
    const day = new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
    const folder = `conversation-${fileSlug(contactName)}-${day}`;
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    const dir = zip.folder(folder);
    if (!dir) throw new Error("EXPORT_FOLDER");
    dir.file("conversation.txt", "﻿" + txt.replace(/\n/g, "\r\n"));
    dir.file("conversation.csv", csv);
    const archive = await zip.generateAsync({
      type: "uint8array",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });

    return new Response(new Blob([archive as BlobPart], { type: "application/zip" }), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${folder}.zip"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    console.error("[chat] Échec de l’export de conversation.");
    return error("Export indisponible. Réessayez.", 500);
  }
}
