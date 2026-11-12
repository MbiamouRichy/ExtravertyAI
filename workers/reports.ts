import "dotenv/config";
import { setTimeout as sleep } from "node:timers/promises";
import { workerDatabase } from "./shared";
import { flushWorkerMonitoring, initWorkerMonitoring, reportWorkerError } from "./monitoring";
import { billingEmailConfig } from "../lib/billing-lifecycle";
import {
  queueNextWeeklyReport,
  deliverNextReportEmail,
} from "../lib/weekly-report-service";

initWorkerMonitoring("reports-worker");
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
    } catch (error) {
      reportWorkerError("[reports-worker] Calcul interrompu ; nouvelle tentative au prochain passage.", error);
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
    } catch (error) {
      reportWorkerError("[reports-worker] Livraison interrompue.", error);
    }
    await sleep(worked ? 600 : 5000, undefined, {
      signal: controller.signal,
    }).catch(() => {});
  }
}
main()
  .catch((error) => {
    reportWorkerError("[reports-worker] Arrêt : vérifier la configuration.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await flushWorkerMonitoring();
    await db.$disconnect();
  });
