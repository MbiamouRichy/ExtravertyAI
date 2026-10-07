import "dotenv/config";
import { stripe } from "../lib/stripe";
import { paidMessageLimit } from "../lib/billing-quota";
import { workerDatabase, notifyProject } from "./shared";
import {
  billingEmailConfig,
  reconcileNextBillingProject,
  deliverNextBillingEmail,
} from "../lib/billing-lifecycle";

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
  if (!process.env.RESEND_API_KEY || !process.env.STRIPE_SECRET_KEY)
    throw new Error("BILLING_CONFIG_MISSING");
  for (const plan of ["starter", "pro", "business"]) {
    if (!process.env[`STRIPE_${plan.toUpperCase()}_PLAN_ID`])
      throw new Error("BILLING_PLAN_CONFIG_MISSING");
    paidMessageLimit(plan);
  }
  const config = billingEmailConfig();
  while (!stopping) {
    let worked = false;
    try {
      const projectId = await reconcileNextBillingProject(
        prisma,
        (id) =>
          stripe.subscriptions.retrieve(
            id,
            { expand: ["latest_invoice"] },
            { timeout: 10000, maxNetworkRetries: 1 },
          ),
        config,
      );
      if (projectId) {
        worked = true;
        await notifyProject(projectId);
      }
    } catch {
      console.error(
        "[billing-worker] Vérification de facturation interrompue.",
      );
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
    } catch {
      console.error("[billing-worker] Envoi interrompu.");
    }
    await sleep(worked ? 600 : 5000);
  }
}
main()
  .catch(() => {
    stopping = true;
    console.error("[billing-worker] Arrêt : vérifier la configuration.");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
