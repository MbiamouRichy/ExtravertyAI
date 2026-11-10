// Contrôle en lecture seule de la facturation Polar de production, avant le
// premier paiement réel. Ne crée, ne modifie et n’affiche aucun secret.
//
// Sur le VPS, avec les variables des workers de production :
//   cd /opt/extravertyai-production
//   docker compose -p extravertyai-production run --rm --no-deps billing-worker \
//     ./node_modules/.bin/tsx scripts/check-polar-production.ts
//
// Code de sortie 0 si tout est prêt, 1 sinon.
import "dotenv/config";
import { matchesPolarProduct } from "../lib/checkout-price";
import { getPolarProduct, PolarApiError, polarProductId } from "../lib/polar";
import { checkPolarEnvironment, checkPolarWebhooks, type Finding } from "../lib/polar-readiness";
import { PRICING_PLANS } from "../lib/pricing";

async function productFindings(): Promise<Finding[]> {
  const findings: Finding[] = [];
  for (const plan of PRICING_PLANS) {
    const id = polarProductId(plan.id);
    if (!id) continue;
    try {
      const matches = matchesPolarProduct(await getPolarProduct(id), plan.id);
      findings.push({
        ok: matches,
        label: `Produit ${plan.id} : mensuel, ${plan.priceCents / 100} USD, actif`,
        detail: matches ? undefined : "prix, devise, période ou archivage différent de lib/pricing.ts",
      });
    } catch (error) {
      findings.push({
        ok: false,
        label: `Produit ${plan.id} lisible chez Polar`,
        detail: error instanceof PolarApiError ? `HTTP ${error.status}` : "réseau indisponible",
      });
    }
  }
  return findings;
}

async function webhookFindings(): Promise<Finding[]> {
  const response = await fetch("https://api.polar.sh/v1/webhooks/endpoints?limit=100", {
    headers: { Authorization: `Bearer ${process.env.POLAR_ACCESS_TOKEN}` },
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!response) return [{ ok: false, label: "Liste des webhooks Polar", detail: "réseau indisponible" }];
  if (response.status === 401 || response.status === 403)
    return [{
      ok: true,
      label: "Webhook Polar : à vérifier à la main",
      detail: "le jeton n’a pas le droit webhooks:read (normal) ; voir docs/production.md",
    }];
  if (!response.ok) return [{ ok: false, label: "Liste des webhooks Polar", detail: `HTTP ${response.status}` }];
  const body = (await response.json()) as { items?: unknown };
  const items = Array.isArray(body.items) ? body.items : [];
  return checkPolarWebhooks(items, process.env.NEXT_PUBLIC_APP_URL ?? "");
}

async function main() {
  const findings = checkPolarEnvironment(process.env);
  const configured = findings.every((finding) => finding.ok);
  if (configured) findings.push(...(await productFindings()), ...(await webhookFindings()));
  for (const finding of findings)
    console.log(`${finding.ok ? "✔" : "✖"} ${finding.label}${!finding.ok && finding.detail ? ` — ${finding.detail}` : finding.ok && finding.detail ? ` (${finding.detail})` : ""}`);
  const failed = findings.filter((finding) => !finding.ok).length;
  console.log(failed ? `\n${failed} point(s) à corriger avant d’encaisser.` : "\nFacturation Polar de production prête.");
  process.exitCode = failed ? 1 : 0;
}

main().catch(() => {
  console.error("Contrôle interrompu.");
  process.exitCode = 1;
});
