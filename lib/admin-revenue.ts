import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import prisma from "@/lib/prisma";
import { listPaidPolarOrders } from "@/lib/polar";
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

// Commandes payées depuis une date, relues au plus une fois par heure.
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

/** Encaissé réel chez Polar ; à défaut, estimation depuis les mois payés. */
export const loadRevenue = cache(async (range: DashboardRange): Promise<RevenueStats> => {
  const period = dashboardPeriod(range);
  if (process.env.POLAR_ACCESS_TOKEN) {
    try {
      const since = Math.floor(period.previousStart.getTime() / 1000);
      const raw = await paidPolarOrdersSince(since);
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
