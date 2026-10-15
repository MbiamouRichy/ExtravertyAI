import type { Metadata } from "next";

import { AnalyticsDashboard } from "@/components/maquettes/analytics/analytics-dashboard";

export const metadata: Metadata = { title: "Analytique" };

export default function AnalyticsMaquette() {
  return <AnalyticsDashboard projectName="Boutique Démo" />;
}
