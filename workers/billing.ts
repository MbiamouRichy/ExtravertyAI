import "dotenv/config";
import { paidMessageLimit } from "../lib/billing-quota";
import { workerDatabase, notifyProject } from "./shared";
import { flushWorkerMonitoring, initWorkerMonitoring, reportWorkerError } from "./monitoring";
import {
  billingEmailConfig,
  reconcileNextBillingProject,
  deliverNextBillingEmail,
} from "../lib/billing-lifecycle";
import { renewInternalQuotas } from "../lib/internal-project";

initWorkerMonitoring("billing-worker");
const prisma = workerDatabase();
let stopping = false;
const controller = new AbortController();
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => {
    stopping = true;
    controller.abort();
  });
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  if (!process.env.RESEND_API_KEY || !process.env.POLAR_ACCESS_TOKEN)
    throw new Error("BILLING_CONFIG_MISSING");
  for (const plan of ["starter", "pro", "business"]) {
    if (!process.env[`POLAR_${plan.toUpperCase()}_PRODUCT_ID`])
      throw new Error("BILLING_PLAN_CONFIG_MISSING");
    paidMessageLimit(plan);
  }
  const config = billingEmailConfig();
  // Projet interne (support) : quota de l'offre Business, vérifié chaque minute.
  const internalLimit = paidMessageLimit("business");
  let internalCheckAt = 0;
  while (!stopping) {
    let worked = false;
    if (Date.now() >= internalCheckAt) {
      internalCheckAt = Date.now() + 60_000;
      try {
        for (const projectId of await renewInternalQuotas(prisma, internalLimit))
          await notifyProject(projectId);
      } catch (error) {
        reportWorkerError("[billing-worker] Quota du projet interne non renouvelé.", error);
      }
    }
    try {
      const projectId = await reconcileNextBillingProject(prisma, config);
      if (projectId) {
        worked = true;
        await notifyProject(projectId);
      }
    } catch (error) {
      reportWorkerError("[billing-worker] Vérification de facturation interrompue.", error);
    }
    try {
      worked =
        (await deliverNextBillingEmail(prisma, async (email) => {
          const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
              "Content-Type": "application/json",
              "Idempotency-Key": `billing/${email.id}`,
            },
            body: JSON.stringify({
              from: email.from,
              to: email.recipient,
              subject: email.subject,
              text: email.text,
              ...(email.html ? { html: email.html } : {}),
            }),
            signal: AbortSignal.any([
              controller.signal,
              AbortSignal.timeout(20000),
            ]),
          });
          const result = await response.json();
          if (!response.ok || typeof result?.id !== "string")
            throw new Error("BILLING_EMAIL_UNCONFIRMED");
          return result.id;
        })) || worked;
    } catch (error) {
      reportWorkerError("[billing-worker] Envoi interrompu.", error);
    }
    await sleep(worked ? 600 : 5000);
  }
}
main()
  .catch((error) => {
    stopping = true;
    reportWorkerError("[billing-worker] Arrêt : vérifier la configuration.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await flushWorkerMonitoring();
    await prisma.$disconnect();
  });
