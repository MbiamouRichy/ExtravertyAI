// Contrôles avant d’encaisser de l’argent réel avec Polar
// (scripts/check-polar-production.ts). Fonctions pures, testées sans réseau.

export const REQUIRED_POLAR_EVENTS = [
  "subscription.created",
  "subscription.active",
  "subscription.updated",
  "subscription.canceled",
  "subscription.uncanceled",
  "subscription.past_due",
  "subscription.revoked",
  "order.paid",
  "order.refunded",
] as const;

export type Finding = { ok: boolean; label: string; detail?: string };

/** Variables de facturation de production : présentes, cohérentes, sans sandbox. */
export function checkPolarEnvironment(env: Record<string, string | undefined>): Finding[] {
  const findings: Finding[] = [];
  const sandbox = env.POLAR_SERVER?.trim();
  findings.push({
    ok: !sandbox,
    label: "POLAR_SERVER vide (argent réel)",
    detail: sandbox ? `vaut « ${sandbox} » : les paiements partiraient vers le sandbox` : undefined,
  });
  for (const name of ["POLAR_ACCESS_TOKEN", "POLAR_WEBHOOK_SECRET"])
    findings.push({ ok: !!env[name]?.trim(), label: `${name} renseigné` });
  for (const name of ["POLAR_ACCESS_TOKEN", "POLAR_WEBHOOK_SECRET"]) {
    const value = env[name]?.trim() ?? "";
    if (value && value === env[`POLAR_SANDBOX_${name.slice("POLAR_".length)}`]?.trim())
      findings.push({ ok: false, label: `${name} différent de la valeur sandbox` });
  }
  const ids = ["STARTER", "PRO", "BUSINESS"].map((plan) => env[`POLAR_${plan}_PRODUCT_ID`]?.trim());
  findings.push({ ok: ids.every(Boolean), label: "Les trois produits Polar sont renseignés" });
  findings.push({
    ok: new Set(ids.filter(Boolean)).size === ids.filter(Boolean).length,
    label: "Un produit différent par offre",
  });
  const appUrl = env.NEXT_PUBLIC_APP_URL?.trim() ?? "";
  let host = "";
  try {
    const url = new URL(appUrl);
    if (url.protocol === "https:") host = url.host;
  } catch {}
  findings.push({
    ok: !!host && !host.endsWith(".vercel.app") && !host.startsWith("localhost"),
    label: "NEXT_PUBLIC_APP_URL est le domaine public en HTTPS",
    detail: host ? undefined : "absent ou non HTTPS",
  });
  return findings;
}

type WebhookEndpoint = { url?: unknown; format?: unknown; events?: unknown };

/**
 * Un endpoint doit viser exactement l’adresse de production (sans redirection,
 * que Polar compte comme un échec), au format brut, avec tous les événements
 * dont l’application a besoin.
 */
export function checkPolarWebhooks(endpoints: WebhookEndpoint[], appUrl: string): Finding[] {
  const expected = `${appUrl.replace(/\/+$/, "")}/api/webhooks/polar`;
  const endpoint = endpoints.find((item) => item.url === expected);
  if (!endpoint)
    return [{ ok: false, label: `Webhook Polar vers ${expected}`, detail: "aucun endpoint à cette adresse exacte" }];
  const events = Array.isArray(endpoint.events) ? endpoint.events.map(String) : [];
  const missing = REQUIRED_POLAR_EVENTS.filter((event) => !events.includes(event));
  return [
    { ok: true, label: `Webhook Polar vers ${expected}` },
    { ok: endpoint.format === "raw", label: "Webhook au format Raw", detail: `format : ${String(endpoint.format)}` },
    { ok: missing.length === 0, label: "Webhook abonné aux événements requis", detail: missing.length ? `manquants : ${missing.join(", ")}` : undefined },
  ];
}
