import { syncWhatsAppSettings } from "../lib/whatsapp-settings-sync";
import "dotenv/config";
import { workerDatabase, notifyProject } from "./shared";
import { reconcileProviderReceipts } from "../lib/provider-reconciliation";
import { createOutboundProcessor } from "../lib/outbound-jobs";
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
main()
  .catch(() => {
    console.error("[outbound-worker] Arrêt sur erreur.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
