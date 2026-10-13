import "dotenv/config";
import { setTimeout as sleep } from "node:timers/promises";
import { workerDatabase } from "./shared";
import { billingEmailConfig } from "../lib/billing-lifecycle";
import {
  queueNextWeeklyReport,
  deliverNextReportEmail,
} from "../lib/weekly-report-service";

const db = workerDatabase();
const controller = new AbortController();
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => controller.abort());
async function main() {
  if (!process.env.RESEND_API_KEY) throw new Error("REPORTS_CONFIG_MISSING");
  const config = billingEmailConfig();
  config.from = process.env.REPORTS_EMAIL_FROM || config.from;
  if (!config.from.includes("@") || /[\r\n]/.test(config.from))
    throw new Error("REPORTS_SENDER_INVALID");
  while (!controller.signal.aborted) {
    let worked = false;
    try {
      worked = await queueNextWeeklyReport(db, config);
    } catch {
      console.error(
        "[reports-worker] Calcul interrompu ; nouvelle tentative au prochain passage.",
      );
    }
    try {
      worked =
        (await deliverNextReportEmail(db, async (email) => {
          const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
              "Content-Type": "application/json",
              "Idempotency-Key": `weekly-report/${email.id}`,
            },
            body: JSON.stringify({
              from: email.from,
              to: email.recipient,
              subject: email.subject,
              text: email.text,
              html: email.html,
            }),
            signal: AbortSignal.any([
              controller.signal,
              AbortSignal.timeout(20000),
            ]),
          });
          const result = await response.json();
          if (!response.ok || typeof result?.id !== "string")
            throw new Error("REPORT_EMAIL_UNCONFIRMED");
          return result.id;
        })) || worked;
    } catch {
      console.error("[reports-worker] Livraison interrompue.");
    }
    await sleep(worked ? 600 : 5000, undefined, {
      signal: controller.signal,
    }).catch(() => {});
  }
}
main()
  .catch(() => {
    console.error("[reports-worker] Arrêt : vérifier la configuration.");
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
