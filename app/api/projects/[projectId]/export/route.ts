import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth-server";
import prisma from "@/lib/prisma";
import { csvCell } from "@/lib/export-csv";
import { contactExportSnapshot, signExportReceipt } from "@/lib/contact-export";
export const runtime = "nodejs";
export async function GET(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const session = await getSession();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
  const membership = await prisma.projectMembership.findUnique({
    where: { userId_projectId: { userId: session.user.id, projectId } },
    select: { role: true },
  });
  if (!membership || !["OWNER", "ADMIN"].includes(membership.role))
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  const format = new URL(req.url).searchParams.get("format") || "csv";
  if (!["csv", "xlsx"].includes(format))
    return NextResponse.json({ error: "Format invalide." }, { status: 400 });
  try {
    const forDeletion = new URL(req.url).searchParams.get("deletion") === "1";
    if (forDeletion && membership.role !== "OWNER")
      return NextResponse.json(
        { error: "Seul le propriétaire peut préparer la suppression." },
        { status: 403 },
      );
    const { contacts, hash } = await contactExportSnapshot(prisma, projectId);
    const header = [
      "Nom",
      "Nom WhatsApp",
      "Téléphone",
      "Assistant actif",
      "Date de création",
    ];
    const rows = contacts.map((c) => [
      c.name || "",
      c.pushName || "",
      c.phone,
      c.aiActive ? "Oui" : "Non",
      c.createdAt.toISOString(),
    ]);
    const headers = {
      "Cache-Control": "private, no-store",
      ...(forDeletion
        ? {
            "X-Export-Receipt": signExportReceipt({
              userId: session.user.id,
              projectId,
              hash,
              format: format as "csv" | "xlsx",
            }),
          }
        : {}),
      "Content-Disposition": `attachment; filename="contacts.${format}"`,
      "X-Content-Type-Options": "nosniff",
    };
    if (format === "csv") {
      const csv =
        "\ufeff" +
        [header, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n");
      return new Response(csv, {
        headers: { ...headers, "Content-Type": "text/csv; charset=utf-8" },
      });
    }
    const { default: ExcelJS } = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    for (let offset = 0; offset < Math.max(1, rows.length); offset += 1000000) {
      const sheet = workbook.addWorksheet(
        "Contacts " + (Math.floor(offset / 1000000) + 1),
      );
      sheet.addRow(header);
      sheet.addRows(rows.slice(offset, offset + 1000000));
      sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      sheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF1D4ED8" },
      };
      sheet.columns.forEach((column) => {
        column.width = 28;
      });
      sheet.views = [{ state: "frozen", ySplit: 1 }];
      sheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: header.length },
      };
    }
    // ExcelJS stores these values as strings, never as executable cell formulas.
    return new Response(new Uint8Array(await workbook.xlsx.writeBuffer()), {
      headers: {
        ...headers,
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "L’export est temporairement indisponible." },
      { status: 503 },
    );
  }
}
