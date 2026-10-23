import { syncWhatsAppSettings } from "../lib/whatsapp-settings-sync";
import "dotenv/config";
import { workerDatabase, notifyProject } from "./shared";
import { reconcileProviderReceipts } from "../lib/provider-reconciliation";
import { createOutboundProcessor } from "../lib/outbound-jobs";
import { claimDelivery, defaultTransport, runDelivery } from "../lib/integrations";
import { appendEventRow } from "../lib/google-sheets";
import { PRESENCE_REFRESH_MS, refreshOnlinePresence } from "../lib/whatsapp-presence";
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
    } catch {
      console.error("[outbound-worker] Cycle interrompu.");
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
    } catch {
      console.error("[integrations] Cycle interrompu.");
      await sleep(5000);
    }
  }
}
// « Afficher le statut en ligne » : présence renvoyée chaque minute.
async function presenceLoop() {
  while (!stopping) {
    try {
      await refreshOnlinePresence(prisma);
    } catch {
      console.error("[presence] Cycle interrompu.");
    }
    // Attente découpée : l’arrêt du worker n’attend pas une minute.
    for (let waited = 0; waited < PRESENCE_REFRESH_MS && !stopping; waited += 1000)
      await sleep(1000);
  }
}
Promise.all([main(), integrationsLoop(), presenceLoop()])
  .catch(() => {
    console.error("[outbound-worker] Arrêt sur erreur.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
