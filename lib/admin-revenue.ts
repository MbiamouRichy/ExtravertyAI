import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import prisma from "@/lib/prisma";
import { checkoutProvider } from "@/lib/billing-provider";
import { listPaidPolarOrders } from "@/lib/polar";
import { stripe } from "@/lib/stripe";
import {
  bucketRevenue,
  dashboardPeriod,
  estimateRevenue,
  loadBillingPeriods,
  type DashboardRange,
  type PaidInvoice,
  type RevenueStats,
} from "@/lib/admin-dashboard";

const MAX_INVOICES = 10_000;

const paidPolarOrdersSince = unstable_cache(
  async (sinceSeconds: number) =>
    (await listPaidPolarOrders(new Date(sinceSeconds * 1000), MAX_INVOICES))
      .filter((order) => order.total_amount > 0)
      .map((order) => ({
        amount: order.total_amount,
        currency: order.currency,
        paidAt: order.created_at,
      })),
  ["admin-paid-polar-orders"],
  { revalidate: 3600 },
);

// Factures payées depuis une date, relues au plus une fois par heure.
const paidInvoicesSince = unstable_cache(
  async (sinceSeconds: number): Promise<{ amount: number; currency: string; paidAt: string }[]> => {
    const invoices: { amount: number; currency: string; paidAt: string }[] = [];
    for await (const invoice of stripe.invoices.list({
      status: "paid",
      created: { gte: sinceSeconds },
      limit: 100,
    })) {
      if (invoice.amount_paid > 0)
        invoices.push({
          amount: invoice.amount_paid,
          currency: invoice.currency,
          paidAt: new Date(
            (invoice.status_transitions?.paid_at ?? invoice.created) * 1000,
          ).toISOString(),
        });
      if (invoices.length >= MAX_INVOICES) break;
    }
    return invoices;
  },
  ["admin-paid-invoices"],
  { revalidate: 3600 },
);

/** Le fournisseur actif d'abord (encaissé réel) ; à défaut, estimation depuis les mois payés. */
export const loadRevenue = cache(async (range: DashboardRange): Promise<RevenueStats> => {
  const period = dashboardPeriod(range);
  const polar = checkoutProvider() === "polar";
  if (polar || process.env.STRIPE_SECRET_KEY) {
    try {
      const since = Math.floor(period.previousStart.getTime() / 1000);
      const raw = await (polar
        ? paidPolarOrdersSince(since)
        : paidInvoicesSince(since));
      const invoices: PaidInvoice[] = raw.map((invoice) => ({
        ...invoice,
        paidAt: new Date(invoice.paidAt),
      }));
      return bucketRevenue(invoices, period);
    } catch {
      console.error("[admin] Paiements indisponibles, revenu estimé.");
    }
  }
  return estimateRevenue(await loadBillingPeriods(prisma, period), period);
});
