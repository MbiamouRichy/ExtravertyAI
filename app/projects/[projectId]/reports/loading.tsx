export default function Loading() {
  return (
    <div role="status" className="space-y-6 p-6">
      <p className="text-sm text-muted-foreground">Chargement des rapports…</p>
      <div className="h-24 animate-pulse rounded-xl bg-muted" />
      <div className="grid gap-4 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-36 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    </div>
  );
}
