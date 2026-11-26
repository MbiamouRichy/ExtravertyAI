import { syncWhatsAppSettings } from "../lib/whatsapp-settings-sync";
import "dotenv/config";
import { workerDatabase, notifyProject } from "./shared";
import { flushWorkerMonitoring, initWorkerMonitoring, reportWorkerError } from "./monitoring";
import { reconcileProviderReceipts } from "../lib/provider-reconciliation";
import { createOutboundProcessor } from "../lib/outbound-jobs";
import { claimDelivery, defaultTransport, runDelivery } from "../lib/integrations";
import { appendEventRow } from "../lib/google-sheets";
import { runBroadcastTick } from "../lib/broadcasts";
import { runScheduledMessageTick } from "../lib/scheduled-messages";
import { PRESENCE_REFRESH_MS, refreshOnlinePresence } from "../lib/whatsapp-presence";
import {
  INSTANCE_CHECK_MS,
  createInstanceHealthMonitor,
  type DisconnectionEmail,
} from "../lib/instance-health";
import { NOREPLY_SENDER } from "../lib/email-senders";
initWorkerMonitoring("outbound-worker");
const prisma = workerDatabase();
const { claimNextJob, dispatch, recoverInterruptedDispatches } =
  createOutboundProcessor(prisma, notifyProject);
let stopping = false;
process.on("SIGTERM", () => {
  stopping = true;
});
process.on("SIGINT", () => {
  stopping = true;
});
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function main() {
  if (!process.env.EVOLUTION_API_URL || !process.env.EVOLUTION_API_KEY)
    throw new Error("Configuration Evolution manquante.");
  let lastRecovery = 0;
  while (!stopping) {
    try {
      if (Date.now() - lastRecovery > 30000) {
        await syncWhatsAppSettings(prisma);
        await recoverInterruptedDispatches();
        for (const projectId of await reconcileProviderReceipts(prisma))
          await notifyProject(projectId);
        lastRecovery = Date.now();
      }
      const job = await claimNextJob();
      if (job) await dispatch(job);
      else await sleep(500);
    } catch (error) {
      reportWorkerError("[outbound-worker] Cycle interrompu.", error);
      await sleep(2000);
    }
  }
}
// Webhooks et Google Sheets : livraisons de la file integration_delivery.
async function integrationsLoop() {
  while (!stopping) {
    try {
      const job = await claimDelivery(prisma);
      if (job) {
        await runDelivery(prisma, job, { ...defaultTransport, sheets: appendEventRow });
        await notifyProject(job.projectId);
      } else await sleep(1000);
    } catch (error) {
      reportWorkerError("[integrations] Cycle interrompu.", error);
      await sleep(5000);
    }
  }
}
// Diffusions : un message à la fois, au rythme de chaque diffusion. Chaque
// message rejoint la file d’envoi normale, sans retarder les conversations.
async function broadcastLoop() {
  while (!stopping) {
    try {
      const tick = await runBroadcastTick(prisma);
      if (tick) await notifyProject(tick.projectId);
      else await sleep(2000);
    } catch (error) {
      reportWorkerError("[broadcast] Cycle interrompu.", error);
      await sleep(5000);
    }
  }
}
// Messages programmés depuis la messagerie : à l’heure dite, chacun est
// revérifié puis confié à la file d’envoi normale. On enchaîne tant qu’il y en
// a d’échus, sinon on revérifie chaque seconde (une minute d’avance minimum).
async function scheduledLoop() {
  while (!stopping) {
    try {
      const tick = await runScheduledMessageTick(prisma);
      if (tick && tick.outcome !== "waiting") await notifyProject(tick.projectId);
      if (!tick) await sleep(1000);
    } catch (error) {
      reportWorkerError("[scheduled-messages] Cycle interrompu.", error);
      await sleep(5000);
    }
  }
}
// « Afficher le statut en ligne » : présence renvoyée chaque minute.
async function presenceLoop() {
  while (!stopping) {
    try {
      await refreshOnlinePresence(prisma);
    } catch (error) {
      reportWorkerError("[presence] Cycle interrompu.", error);
    }
    // Attente découpée : l’arrêt du worker n’attend pas une minute.
    for (let waited = 0; waited < PRESENCE_REFRESH_MS && !stopping; waited += 1000)
      await sleep(1000);
  }
}
// État réel des numéros WhatsApp : un webhook perdu ne doit pas laisser
// l’application croire un numéro connecté. Les administrateurs sont prévenus.
async function sendDisconnectionEmail(email: DisconnectionEmail) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": email.idempotencyKey,
    },
    body: JSON.stringify({
      from: NOREPLY_SENDER,
      to: email.to,
      subject: email.subject,
      html: email.html,
      text: email.text,
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error("DISCONNECTION_EMAIL_UNCONFIRMED");
}
async function instanceHealthLoop() {
  const checkInstances = createInstanceHealthMonitor({
    db: prisma,
    sendEmail: process.env.RESEND_API_KEY ? sendDisconnectionEmail : undefined,
  });
  while (!stopping) {
    try {
      const { demoted } = await checkInstances();
      for (const projectId of demoted) await notifyProject(projectId);
    } catch (error) {
      reportWorkerError("[instance-health] Cycle interrompu.", error);
    }
    for (let waited = 0; waited < INSTANCE_CHECK_MS && !stopping; waited += 1000)
      await sleep(1000);
  }
}
Promise.all([
  main(),
  integrationsLoop(),
  broadcastLoop(),
  scheduledLoop(),
  presenceLoop(),
  instanceHealthLoop(),
])
  .catch((error) => {
    reportWorkerError("[outbound-worker] Arrêt sur erreur.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await flushWorkerMonitoring();
    await prisma.$disconnect();
  });
