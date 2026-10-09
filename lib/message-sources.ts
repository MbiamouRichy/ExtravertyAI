export function visibleMessageSources(
  data: { source: string; count: number }[],
  others: { source: string; count: number }[] = [],
) {
  const totals = new Map<string, number>();
  const add = (source: string, count: number) => {
    if (count > 0) totals.set(source, (totals.get(source) ?? 0) + count);
  };
  for (const row of data) {
    if (row.source !== "unknown" || !others.length) add(row.source, row.count);
    else {
      for (const other of others) add(other.source, other.count);
      add(
        "unknown",
        row.count - others.reduce((sum, other) => sum + other.count, 0),
      );
    }
  }
  const labels: Record<string, string> = {
    android: "Android",
    ios: "iOS",
    ai: "Assistant IA",
    whatsapp: "WhatsApp",
    web_dashboard: "Tableau de bord",
    unknown: "Origine non renseignée",
  };
  return [...totals]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([source, count], index) => ({
      source,
      count,
      label: labels[source] ?? source,
      key: "source" + index,
      fill: "var(--chart-" + ((index % 5) + 1) + ")",
    }));
}
