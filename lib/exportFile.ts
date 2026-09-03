import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface ExportableContact {
  name: string | null;
  pushName: string | null;
  phone: string;
  aiActive: boolean;
  createdAt: string | Date;
}

export interface TableDataRow<TData> {
  original: TData;
}

export interface TableDataInstance<TData> {
  getFilteredRowModel: () => {
    rows: TableDataRow<TData>[];
  };
}

// 1. On ajoute <TData> ici pour dire à la fonction d'accepter le type générique de votre tableau
export const handleExport = async <TData>(
  format: string,
  table: TableDataInstance<TData>,
) => {
  const rows = table.getFilteredRowModel().rows;
  const dateStr = new Date().toISOString().slice(0, 10);
  const fileNameBase = `contacts_crm_${dateStr}`;

  const headers = [
    "Nom",
    "Nom WhatsApp",
    "Telephone",
    "Statut IA",
    "Date de creation",
  ];

  // 2. On type r avec le type générique TData
  const rowsData: string[][] = rows.map((r: TableDataRow<TData>) => {
    // 3. On force TypeScript à interpréter la ligne comme un ExportableContact
    const rowData = r.original as unknown as ExportableContact;
    return [
      rowData.name || "",
      rowData.pushName || "",
      String(rowData.phone || ""),
      rowData.aiActive ? "Oui" : "Non",
      new Date(rowData.createdAt).toISOString(),
    ];
  });

  const downloadFile = (blob: Blob, extension: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${fileNameBase}.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  switch (format) {
    case "csv": {
      const csvContent = [
        headers.join(","),
        ...rowsData.map((row: string[]) =>
          row.map((cell: string) => `"${cell}"`).join(","),
        ),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      downloadFile(blob, "csv");
      break;
    }

    case "pdf": {
      const doc = new jsPDF();
      autoTable(doc, {
        head: [headers],
        body: rowsData,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [41, 128, 185] },
      });
      doc.save(`${fileNameBase}.pdf`);
      break;
    }
    default:
      console.error("Format d'export non supporté :", format);
  }
};
